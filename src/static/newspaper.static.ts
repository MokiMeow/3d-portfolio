export const NEWSPAPER_COVER = '/newspaper/founders-front-page.jpg';

/** Original satire; the supplied cover is reproduced intact, including its parody labels. */
export const NEWSPAPER_PAGES = [
  { section: 'Front page', short: 'Front page', kind: 'cover' },
  {
    section: 'Bengaluru & beyond', short: 'City', kind: 'city',
    kicker: 'THE CITY THAT NEVER SAYS “I’M FIVE MINUTES AWAY” ACCURATELY',
    title: 'Man leaves early.\nReaches at the usual time.',
    subtitle: 'A brave experiment in Bengaluru timekeeping ends exactly where everybody expected.',
    byline: 'Our entirely fictional city correspondent',
    paragraphs: [
      'BENGALURU — A local commuter set his alarm forty minutes earlier on Tuesday, only to arrive at the office at his regular time. “The traffic also left early,” he told this newspaper, looking respectfully at a signal he now considers a colleague.',
      'The journey included three podcasts, one career rethink and a meaningful exchange of eye contact with the same auto driver at seven consecutive junctions. By the fifth signal, they were discussing a joint birthday celebration.',
      'His manager praised the initiative, then asked whether tomorrow he could simply arrive yesterday. The commuter has requested a work-from-signal arrangement. Negotiations are currently at a standstill.',
    ],
    caption: 'At the signal: enough time for a cutting chai, a full conversation and a second cutting chai.',
    briefs: [
      { title: 'Chai stall rejects app, retains customers', text: 'The owner says his recommendation engine already knows everyone’s order. “You look tired. Strong tea.” Investors have described the system as suspiciously efficient.' },
      { title: '“On the way” gets a new definition', text: 'A neighbourhood friend group has voted to interpret the phrase as “currently choosing a shirt”. “Almost there” will continue to mean “looking for keys”.' },
      { title: 'Pigeon secures corner office', text: 'The new occupant of a balcony refuses to pay rent, attends no meetings and has already brought a colleague. Residents describe its confidence as senior-management level.' },
    ],
    quote: 'The destination is temporary. The signal is a community.',
    ribbon: 'CITY FORECAST  /  Cloudy, with a 90% chance of someone saying “nice weather, no?”',
  },
  {
    section: 'Science, mildly applied', short: 'Tech', kind: 'tech',
    kicker: 'FROM THE DEPARTMENT OF UNNECESSARY INNOVATION',
    title: 'AI does every task.\nExcept naming the file.',
    subtitle: 'Breakthrough system saves work as final_final_REAL_final_v7. Industry feels seen.',
    byline: 'The desk of advanced guesswork',
    paragraphs: [
      'LAB REPORT — An experimental assistant has written a thousand lines of code, organised a calendar and summarised an unread document. It then spent twenty-three minutes deciding whether to call a folder “new” or “new2”.',
      'The research team called this a landmark moment. “We were looking for human-like intelligence,” said a fictional spokesperson. “We have successfully reproduced human-like desktop management.” A second model was summoned to locate the file. It created a duplicate.',
      'Meanwhile, the office printer has become the first machine to achieve complete independence. It refuses all instructions, prints only when nobody is watching, and has asked the team to respect its creative process.',
    ],
    caption: 'Our laboratory assistant has solved the problem by moving it to a different folder.',
    briefs: [
      { title: 'Password demands one happy memory', text: 'After uppercase, lowercase, symbols and numbers, the form now wants “something meaningful”. The user entered the day before passwords existed. Rejected: too predictable.' },
      { title: 'Bug disappears during screen share', text: 'A defect that appeared 47 times before the call is now behaving impeccably. Engineers have proposed keeping a manager on video permanently. Nobody has volunteered.' },
      { title: 'Smart fridge knows too much', text: 'The fridge sent a notification reading “again?” at 1:12 a.m. Its owner has disabled analytics and returned to opening the door very quietly.' },
    ],
    quote: 'It works on my machine. Unfortunately, my machine is on leave.',
    ribbon: 'LAB NOTE  /  This page contains no actual scientific breakthroughs. The printer remains uncooperative.',
  },
  {
    section: 'Sport & the good life', short: 'Weekend', kind: 'sport',
    kicker: 'LIVE FROM THE STADIUM BETWEEN TWO PARKED SCOOTERS',
    title: 'Third umpire is aunty\non the second floor.',
    subtitle: 'Gully cricket adopts a review system. Her decision is final. So is dinner at eight.',
    byline: 'Our boundary-wall correspondent',
    paragraphs: [
      'SPORTS DESK — After a disputed one-tip-one-hand catch, the lane appointed a neutral observer: the neighbour who had been watching the entire match while hanging laundry. She immediately overturned three decisions and asked who had hit her flowerpot.',
      'The new rules are clear. The scooter is four, the terrace is six and the locked house is “you hit it, you get it”. A ball landing in the pressure-cooker whistle zone may be declared dinner.',
      'Play was suspended when the only person who owned a bat went home. Analysts called this a dramatic shift in the balance of power. Both sides have appealed to his mother.',
    ],
    caption: 'Decision pending. The upstairs review system is checking whether that was her window.',
    briefs: [
      { title: 'Playlist friend skips his own song', text: 'After saying “wait for the good part” for three minutes, he has quietly moved to the next track. The group has placed his aux-cable privileges under review.' },
      { title: 'Dosa survives photograph, barely', text: 'A breakfast spent eleven minutes posing beside a filter coffee. Witnesses say it was finally eaten after the caption “simple joys” required six drafts.' },
      { title: 'Book bought. Personality updated.', text: 'A reader has placed a difficult novel on the coffee table and is now referring to weekends as “a slower season”. Page two is scheduled for next month.' },
    ],
    quote: 'One more over is not a measure of time. It is a way of life.',
    ribbon: 'RESULTS  /  Street XI: 84, approximately.  /  Lost balls: 2.  /  Arguments: still counting.',
  },
  { section: 'The puzzle page', short: 'Puzzles', kind: 'puzzles' },
  { section: 'Last, but least serious', short: 'Back page', kind: 'back' },
] as const;

export const NEWSPAPER_CLASSIFIEDS = [
  { label: 'WANTED', title: 'One charger. Any charger.', text: 'Must fit a drawer containing eleven almost-correct cables. Excellent opportunity for the right connector.' },
  { label: 'LOST & FOUND', title: 'A weekend, barely used.', text: 'Last seen on Friday evening. Answers to “we should do something”. If found, please return before Monday.' },
  { label: 'TO LET', title: 'Spacious browser tab.', text: 'Unfurnished, opened six months ago. Close to 38 other tabs. Owner cannot remember why it is there.' },
  { label: 'SITUATIONS VACANT', title: 'Chief Biscuit Officer.', text: 'Must know the precise moment before a biscuit falls into tea. Experience with structural failure preferred.' },
  { label: 'PERSONAL', title: 'Dear missing sock,', text: 'It has been three washes. Your partner is trying to move on. Please call. No questions asked.' },
  { label: 'PUBLIC NOTICE', title: 'The group trip is happening.', text: 'Dates, destination, budget and attendees are yet to be decided. The group name has been finalised.' },
] as const;
