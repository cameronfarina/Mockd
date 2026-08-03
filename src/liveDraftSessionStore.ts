import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type LiveDraftCommandImportFormat = "csv" | "json";

export type LiveDraftStoreMutation =
  | { type: "initialize" }
  | { type: "sale"; command: string }
  | { type: "undo"; removedCommand?: string }
  | { type: "reset"; previousCommandCount: number }
  | { type: "import"; importedCount: number; previousCommandCount: number };

export interface LiveDraftSessionPaths {
  directory: string;
  logPath: string;
  currentPath: string;
  backupPath: string;
}

export interface LiveDraftSessionSnapshot {
  version: 1;
  updatedAt: string;
  commandCount: number;
  commands: string[];
  lastMutation: LiveDraftStoreMutation;
}

export interface LiveDraftAuditLogEntry extends LiveDraftSessionSnapshot {
  sequence: number;
  timestamp: string;
  mutation: LiveDraftStoreMutation;
}

export interface LiveDraftSessionStatus {
  commandCount: number;
  paths: LiveDraftSessionPaths;
  loadedAt?: string;
}

export interface FileBackedLiveDraftSessionStoreOptions {
  directory?: string;
}

const defaultSessionDirectory = "data/live-draft";
const snapshotVersion = 1;

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT";

const validateCommandList = (commands: unknown): string[] => {
  if (!Array.isArray(commands)) throw new Error("Draft command import must contain a commands array.");

  return commands.map((command, index) => {
    if (typeof command !== "string") throw new Error(`Draft command ${index + 1} must be a string.`);
    const trimmed = command.trim();
    if (!trimmed) throw new Error(`Draft command ${index + 1} is blank.`);
    return trimmed;
  });
};

const snapshotFor = (
  commands: readonly string[],
  mutation: LiveDraftStoreMutation,
  timestamp: string,
): LiveDraftSessionSnapshot => ({
  version: snapshotVersion,
  updatedAt: timestamp,
  commandCount: commands.length,
  commands: [...commands],
  lastMutation: mutation,
});

const parseSnapshot = (content: string): LiveDraftSessionSnapshot => {
  const snapshot = JSON.parse(content) as Partial<LiveDraftSessionSnapshot>;
  if (snapshot.version !== snapshotVersion) throw new Error("Unsupported live draft snapshot version.");
  return {
    version: snapshotVersion,
    updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : new Date(0).toISOString(),
    commandCount: validateCommandList(snapshot.commands).length,
    commands: validateCommandList(snapshot.commands),
    lastMutation: snapshot.lastMutation ?? { type: "initialize" },
  };
};

const auditLineCount = async (path: string): Promise<number> => {
  try {
    const content = await readFile(path, "utf8");
    const trimmed = content.trim();
    return trimmed ? trimmed.split("\n").length : 0;
  } catch (error) {
    if (isMissingFileError(error)) return 0;
    throw error;
  }
};

const readFileIfPresent = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
};

const restoreFile = async (path: string, content: string | undefined): Promise<void> => {
  if (content === undefined) {
    await rm(path, { force: true });
    return;
  }

  await writeFile(path, content, "utf8");
};

const csvEscape = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;

const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inQuotes) {
      if (character === "\"" && content[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (character === "\"") {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === "\"") {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character === "\r") continue;
    field += character;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(candidate => candidate.some(fieldValue => fieldValue.trim()));
};

export const liveDraftCommandsJson = (commands: readonly string[]): string =>
  `${JSON.stringify({ version: snapshotVersion, commands: [...commands] }, null, 2)}\n`;

export const liveDraftCommandsCsv = (commands: readonly string[]): string =>
  `index,command\n${commands.map((command, index) => `${index + 1},${csvEscape(command)}`).join("\n")}\n`;

export const parseLiveDraftCommandImport = (
  content: string,
  format: LiveDraftCommandImportFormat,
): string[] => {
  if (format === "json") {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) return validateCommandList(parsed);
    if (parsed && typeof parsed === "object" && "commands" in parsed) {
      return validateCommandList((parsed as { commands: unknown }).commands);
    }
    throw new Error("JSON draft-log import must be an array or an object with commands.");
  }

  const rows = parseCsvRows(content);
  const header = rows[0]?.map(cell => cell.trim().toLowerCase());
  const commandIndex = header?.indexOf("command") ?? -1;
  if (!header || commandIndex < 0) throw new Error("CSV draft-log import must include a command column.");
  return validateCommandList(rows.slice(1).map(row => row[commandIndex] ?? ""));
};

export class FileBackedLiveDraftSessionStore {
  readonly paths: LiveDraftSessionPaths;

  private commands: string[] = [];
  private loadedAt: string | undefined;

  constructor(options: FileBackedLiveDraftSessionStoreOptions = {}) {
    const directory = options.directory ?? defaultSessionDirectory;
    this.paths = {
      directory,
      logPath: join(directory, "live-draft-log.jsonl"),
      currentPath: join(directory, "live-draft-current.json"),
      backupPath: join(directory, "live-draft-backup.json"),
    };
  }

  currentCommands(): string[] {
    return [...this.commands];
  }

  status(): LiveDraftSessionStatus {
    return {
      commandCount: this.commands.length,
      paths: this.paths,
      ...(this.loadedAt === undefined ? {} : { loadedAt: this.loadedAt }),
    };
  }

  async load(): Promise<string[]> {
    await mkdir(this.paths.directory, { recursive: true });

    const snapshot = await this.readExistingSnapshot();
    if (snapshot) {
      this.commands = [...snapshot.commands];
      this.loadedAt = new Date().toISOString();
      return this.currentCommands();
    }

    return this.persist({ type: "initialize" }, []);
  }

  async appendCommand(command: string): Promise<string[]> {
    const trimmed = command.trim();
    if (!trimmed) throw new Error("Command is required.");
    return this.persist({ type: "sale", command: trimmed }, [...this.commands, trimmed]);
  }

  async undo(): Promise<string[]> {
    const nextCommands = this.commands.slice(0, -1);
    const removedCommand = this.commands.at(-1);
    return this.persist(
      removedCommand === undefined ? { type: "undo" } : { type: "undo", removedCommand },
      nextCommands,
    );
  }

  async reset(): Promise<string[]> {
    return this.persist({ type: "reset", previousCommandCount: this.commands.length }, []);
  }

  async importCommands(commands: readonly string[]): Promise<string[]> {
    const nextCommands = validateCommandList([...commands]);
    return this.persist(
      { type: "import", importedCount: nextCommands.length, previousCommandCount: this.commands.length },
      nextCommands,
    );
  }

  private async readExistingSnapshot(): Promise<LiveDraftSessionSnapshot | undefined> {
    try {
      return parseSnapshot(await readFile(this.paths.currentPath, "utf8"));
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }

    try {
      return parseSnapshot(await readFile(this.paths.backupPath, "utf8"));
    } catch (error) {
      if (isMissingFileError(error)) return undefined;
      throw error;
    }
  }

  private async persist(
    mutation: LiveDraftStoreMutation,
    nextCommands: readonly string[],
  ): Promise<string[]> {
    await mkdir(this.paths.directory, { recursive: true });

    const timestamp = new Date().toISOString();
    const snapshot = snapshotFor(nextCommands, mutation, timestamp);
    const snapshotContent = `${JSON.stringify(snapshot, null, 2)}\n`;
    const sequence = await auditLineCount(this.paths.logPath) + 1;
    const auditEntry: LiveDraftAuditLogEntry = {
      ...snapshot,
      sequence,
      timestamp,
      mutation,
    };
    const currentTempPath = `${this.paths.currentPath}.tmp`;
    const backupTempPath = `${this.paths.backupPath}.tmp`;
    const previousCurrentContent = await readFileIfPresent(this.paths.currentPath);
    const previousBackupContent = await readFileIfPresent(this.paths.backupPath);

    try {
      await writeFile(currentTempPath, snapshotContent, "utf8");
      await writeFile(backupTempPath, snapshotContent, "utf8");
      await rename(currentTempPath, this.paths.currentPath);
      await rename(backupTempPath, this.paths.backupPath);
      await appendFile(this.paths.logPath, `${JSON.stringify(auditEntry)}\n`, "utf8");
    } catch (error) {
      await Promise.allSettled([
        restoreFile(this.paths.currentPath, previousCurrentContent),
        restoreFile(this.paths.backupPath, previousBackupContent),
        rm(currentTempPath, { force: true }),
        rm(backupTempPath, { force: true }),
      ]);
      throw error;
    }

    this.commands = [...nextCommands];
    this.loadedAt = timestamp;
    return this.currentCommands();
  }
}
