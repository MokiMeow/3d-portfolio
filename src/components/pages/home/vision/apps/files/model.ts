export type FileKind = 'folder' | 'text' | 'markdown' | 'json' | 'image' | 'pdf' | 'audio' | 'model' | 'zip' | 'design';
export type FileStorage = 'device' | 'cloud' | 'shared' | 'downloads';
export type FileTag = 'Important' | 'Later' | 'Favourite';
export type FileEntry = {
  id: number;
  name: string;
  parent: number | null;
  storage: FileStorage;
  kind: FileKind;
  bytes: number;
  modified: number;
  tag: FileTag | '';
  detail: string;
  content: string;
  deleted: boolean;
};
export const MAX_FILE_ENTRIES = 1000;
export const MAX_FILE_CONTENT = 50000;
export const MAX_FILE_NAME = 180;
export const FILE_TAGS: FileTag[] = ['Important', 'Later', 'Favourite'];
export const KIND_NAMES: Record<FileKind, string> = {
  folder: 'Folder', text: 'Text document', markdown: 'Markdown', json: 'JSON document',
  image: 'Image', pdf: 'PDF document', audio: 'Audio', model: '3D object', zip: 'Archive', design: 'Design document',
};
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return bytes + ' B';
  if (bytes < 1000000) return (bytes / 1000).toFixed(1) + ' KB';
  return (bytes / 1000000).toFixed(1) + ' MB';
}
export function seedFiles(): FileEntry[] {
  const result: FileEntry[] = [];
  const add = (
    id: number, name: string, parent: number | null, storage: FileStorage, kind: FileKind,
    bytes: number, tag: FileTag | '', detail: string, content = '',
  ): void => {
    result.push({ id, name, parent, storage, kind, bytes, tag, detail, content, modified: 1791936000000 - id * 3600000, deleted: false });
  };
  add(1, 'Projects, eventually', null, 'device', 'folder', 0, 'Later', 'A comfortable home for ambitious intentions.');
  add(2, 'Screenshots of screenshots', null, 'device', 'folder', 0, 'Important', 'Evidence that something once looked right.');
  add(3, 'Chai research', null, 'cloud', 'folder', 0, 'Important', 'A deeply steeped body of work.');
  add(4, 'final_final_REAL_v7.fig', 1, 'device', 'design', 14200000, 'Later', 'The final version. Until the next final version.');
  add(5, 'do_not_open.zip', null, 'device', 'zip', 404000000, 'Later', 'Contents: another archive named definitely_do_not_open.zip.');
  add(6, 'taxes_2019_maybe.pdf', null, 'cloud', 'pdf', 2100000, 'Important', 'An entirely fictional document with impressively vague numbers.');
  add(7, 'meeting_that_could_be_a_note.txt', 1, 'device', 'text', 800, 'Later', 'Agenda: discuss. Outcome: another discussion.',
    'Meeting notes\n\nAgenda: discuss.\nOutcome: another discussion.\n\nAction items\n1. Reduce the number of action items.\n2. Schedule a meeting about item one.');
  add(8, 'it_was_green_yesterday.png', 2, 'device', 'image', 1800000, 'Important', 'A lovingly preserved passing build.', 'lakeside');
  add(9, 'bug_before_the_demo.png', 2, 'device', 'image', 2400000, 'Later', 'Captured just before a very confident explanation.', 'kiara');
  add(10, 'screenshot_of_a_screenshot.png', 2, 'device', 'image', 3200000, 'Important', 'Image quality: recursive.', 'pines');
  add(11, 'chai_temperature_study.pdf', 3, 'cloud', 'pdf', 4200000, 'Important', 'Conclusion: drink it before opening your inbox.');
  add(12, 'ginger_vs_cardamom.txt', 3, 'cloud', 'text', 1100, 'Important', 'Both. The answer was both.',
    'Ginger vs cardamom\n\nBoth. The answer was both.\n\nMethod: brew, taste, repeat.\nPeer review: Amma approved the ingredients.\nLimitations: all samples were consumed.');
  add(13, 'please_review_before_monday.fig', null, 'shared', 'design', 8600000, 'Later', 'The review deadline is a state of mind.');
  add(14, 'scope_creep_v2.pdf', null, 'shared', 'pdf', 9700000, 'Later', 'A small feature, now available in seven volumes.');
  add(15, 'readme_before_you_panic.txt', null, 'device', 'text', 1400, 'Important', 'Step one: breathe. Step two: check the console. Step three: chai.',
    [
      "Before you panic",
      "",
      "Step one: breathe.",
      "Step two: check the console.",
      "Step three: chai.",
      "",
      "If the problem disappears when someone watches, it is still a problem.",
      "Please write it down before it gets shy.",
    ].join('\n'));
  add(16, 'fixItLater.ts', 1, 'device', 'text', 300, 'Later', 'A carefully deferred implementation of optimism.',
    "async function fixItLater() {\n  await makeChai();\n  return 'tomorrow';\n}\n\n// Tomorrow remains a moving target.");
  add(17, 'Definitely the final folder', 1, 'device', 'folder', 0, 'Later', 'It has a parent folder. It has commitment issues.');
  add(18, 'Archive of final folders', 17, 'device', 'folder', 0, '', 'History, with increasingly urgent suffixes.');
  add(19, 'README.md', 17, 'device', 'markdown', 2300, 'Important', 'A small field guide to shipping things.',
    [
      "# The Almost Finished Project",
      "",
      "A field guide to the last ten percent.",
      "",
      "## Before shipping",
      "- Read the error message. All of it.",
      "- Try the small screen.",
      "- Make tea while the build runs.",
      "",
      "## Definition of done",
      "The button does the thing the button says.",
      "",
      "> Future you is a real user. Leave them a note.",
    ].join('\n'));
  add(20, 'production_probably.json', 18, 'device', 'json', 1900, 'Later', 'Valid JSON. Questionable confidence.',
    [
      "{",
      "  \"environment\": \"production, probably\",",
      "  \"debug\": false,",
      "  \"retryCount\": 3,",
      "  \"shipIt\": true,",
      "  \"ownerOfTheBug\": null,",
      "  \"features\": [\"chai\", \"optimism\", \"one more fix\"]",
      "}",
    ].join('\n'));
  add(21, 'Things with handles', null, 'device', 'folder', 0, 'Favourite', 'Objects that make a convincing argument for another break.');
  add(22, 'emotional_support_mug.usdz', 21, 'device', 'model', 7400000, 'Favourite', 'A spatial mug. Zero spills. Unlimited moral support.');
  add(23, 'keyboard_at_midnight.wav', null, 'downloads', 'audio', 3200000, 'Later', 'An original little electronic study in not going to sleep.', '8');
  add(24, 'Places without notifications', null, 'cloud', 'folder', 0, 'Favourite', 'Airplane mode, but with better scenery.');
  add(25, 'Desert', 24, 'cloud', 'folder', 0, '', 'A very large place to leave a small worry.');
  add(26, 'nothing_for_miles.webp', 25, 'cloud', 'image', 4600000, 'Favourite', 'Goegap Desert. Photograph: Poly Haven, CC0.', 'goegap');
  add(27, 'clouds_have_no_backlog.webp', 24, 'cloud', 'image', 5100000, 'Favourite', 'Cape Hill. Photograph: Poly Haven, CC0.', 'cape');
  add(28, 'beach_final_really.webp', null, 'downloads', 'image', 6200000, '', 'Mondello Beach. Photograph: Poly Haven, CC0.', 'mondello');
  add(29, 'team_agreement.md', null, 'shared', 'markdown', 700, 'Important', 'The important bits fit in a surprisingly small file.',
    [
      "# Team agreement",
      "",
      "- Review with kindness.",
      "- Name the variable.",
      "- Ask before deleting the database.",
      "",
      "## Availability",
      "Online, except when making chai.",
      "",
      "> No meeting without an agenda. No agenda without a reason.",
    ].join('\n'));
  add(30, 'definitely_do_not_open.zip', null, 'downloads', 'zip', 1200000, 'Later', 'The nested warning has arrived independently.');
  add(31, 'the_old_final.txt', 18, 'device', 'text', 650, '', 'Kept for historical embarrassment.', 'This was the final version.\n\nArchaeologists disagree.');
  add(32, 'aurora_without_a_deadline.webp', 24, 'cloud', 'image', 3700000, '', 'Milky Way. Photograph: Poly Haven, CC0.', 'night');
  add(33, 'untitled_no_longer.txt', null, 'device', 'text', 400, '', 'A blank document given a second chance.', 'It is okay to start small.');
  const deleted = result.find(item => item.id === 33);
  if (deleted) deleted.deleted = true;
  return result;
}
export function readSavedFiles(raw: string): FileEntry[] | undefined {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > MAX_FILE_ENTRIES) return;
  const ids = new Set<number>();
  const kinds = Object.keys(KIND_NAMES);
  const valid = parsed.every((value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) return false;
    ids.add(item.id);
    return typeof item.name === 'string' && item.name.length > 0 && item.name.length <= MAX_FILE_NAME
      && (item.parent === null || typeof item.parent === 'number' && Number.isSafeInteger(item.parent))
      && typeof item.kind === 'string' && kinds.includes(item.kind)
      && typeof item.storage === 'string' && ['device', 'cloud', 'shared', 'downloads'].includes(item.storage)
      && typeof item.bytes === 'number' && Number.isSafeInteger(item.bytes) && item.bytes >= 0
      && typeof item.modified === 'number' && Number.isFinite(item.modified) && Math.abs(item.modified) <= 8640000000000000
      && typeof item.tag === 'string' && ['', ...FILE_TAGS].includes(item.tag)
      && typeof item.detail === 'string' && item.detail.length <= 1000
      && typeof item.content === 'string' && item.content.length <= MAX_FILE_CONTENT
      && typeof item.deleted === 'boolean';
  });
  if (!valid) return;
  const entries = parsed as FileEntry[];
  const byId = new Map(entries.map(item => [item.id, item]));
  for (const item of entries) {
    const seen = new Set<number>([item.id]);
    let parent = item.parent;
    while (parent !== null) {
      if (seen.has(parent)) return;
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor || ancestor.kind !== 'folder') return;
      parent = ancestor.parent;
    }
  }
  return entries;
}
