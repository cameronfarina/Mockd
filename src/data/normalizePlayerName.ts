const canonicalNameByAlias = new Map<string, string>([
  ["Aaron Jones Sr.", "Aaron Jones"],
  ["Brian Thomas Jr.", "Brian Thomas"],
  ["Brian Robinson Jr.", "Brian Robinson"],
  ["Chris Rodriguez Jr.", "Chris Rodriguez"],
  ["Deebo Samuel Sr.", "Deebo Samuel"],
  ["Devon Achane", "De'Von Achane"],
  ["D.J. Moore", "DJ Moore"],
  ["DJ Chark Jr.", "DJ Chark"],
  ["Hollywood Brown", "Marquise Brown"],
  ["J.K. Dobbins", "JK Dobbins"],
  ["Marvin Mims Jr.", "Marvin Mims"],
  ["Michael Pittman Jr.", "Michael Pittman"],
  ["Odell Beckham Jr.", "Odell Beckham"],
  ["Patrick Mahomes II", "Patrick Mahomes"],
  ["Travis Etienne Jr.", "Travis Etienne"],
]);

export const cleanPlayerName = (name: string): string =>
  name.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export const normalizePlayerName = (name: string): string => {
  const cleaned = cleanPlayerName(name);
  return canonicalNameByAlias.get(cleaned) ?? cleaned;
};
