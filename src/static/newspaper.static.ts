export const NEWSPAPER_PAGES = [
  {
    section: 'The front page', title: 'Small room. Big ideas.', subtitle: 'A place to make, pause and notice.', art: 'room',
    caption: 'An original drawing of a place for unfinished ideas.',
    articles: [
      { title: 'The room is part of the story', text: 'A portfolio can be a list of things made. It can also be somewhere to spend a little time. This room lets the work share a space with records, a newspaper, a plant and the ordinary objects around a desk. Start anywhere. There is no correct order.' },
      { title: 'Take the long way round', text: 'Turn the camera. Look closer. Open a drawer, try the phone, change the drawing or put a song on. Small interactions reward curiosity without asking you to finish a tour. The best detail is often the one you discover yourself.' },
    ], note: 'Inside this edition: listening notes / design margins / work in progress / a little green / the back page',
  },
  {
    section: 'Listening notes', title: 'Give a record its time.', subtitle: 'A small pause between one thought and the next.', art: 'record',
    caption: 'Side A: the room soundtrack. Side B: whatever you bring.',
    articles: [
      { title: 'One room, two ways to listen', text: 'The room has its own lo-fi soundtrack. The record player also accepts a music link, so the listening corner can sound like you. Start a track and the needle meets the groove; pause it and the arm returns to rest.' },
      { title: 'No hurry to skip', text: 'Some ideas arrive while your attention is elsewhere. A familiar melody, a quiet desk, a page you have already read. Leave a little space between tasks. Even the most carefully built room needs a moment when nothing is asking for a click.' },
    ], note: 'Listening suggestion: one favourite song, all the way through. No multitasking required.',
  },
  {
    section: 'In the margins', title: 'Leave a little room.', subtitle: 'Not every empty space needs filling.', art: 'room',
    caption: 'A drawing can begin with the space around an object.',
    articles: [
      { title: 'First, decide what matters', text: 'A strong composition gives the eye somewhere to begin. Make the important thing clear, then let the quieter details support it. If every element is calling for attention, none of them gets heard. Contrast is useful only when it has a purpose.' },
      { title: 'Motion should explain', text: 'A drawer slides from where it belongs. A needle lifts before it moves. A page turns because you asked it to. Motion feels natural when the beginning, the movement and the landing tell the same story. A small, well-timed gesture can say more than a whole screen of effects.' },
    ], note: 'A useful test: remove one thing. If the idea becomes clearer, keep the space.',
  },
  {
    section: 'From the workbench', title: 'Under the surface.', subtitle: 'A few different ways to ask: how does this work?', art: 'room',
    caption: 'The visible interface is only one layer of a project.',
    articles: [
      { title: 'Bare Metal', text: 'An operating-system project in C and Assembly. Working close to the machine makes familiar abstractions visible again: memory, interrupts and the instructions underneath a running program.' },
      { title: 'ZKAuth', text: 'An exploration of zero-knowledge authentication. The interesting question is what a system needs to verify, and what information it should never need to collect.' },
      { title: 'OARS & Aurora', text: 'Two projects exploring the systems around AI work: security governance and engineering orchestration. Find their repository links in the projects area, alongside the rest of the work.' },
    ], note: 'For implementations and project details, visit the Projects station after reading.',
  },
  {
    section: 'Small observations', title: 'A little green goes far.', subtitle: 'Something living in a room full of machines.', art: 'plant',
    caption: 'Light, soil, a little patience. A study in ordinary things.',
    articles: [
      { title: 'Details have a job', text: 'The dark soil beneath a plant, a folded edge of paper, a cup placed within reach: these things give an object a reason to be somewhere. Detail is not just adding more geometry. It is making the small decisions agree with the larger scene.' },
      { title: 'A very small optimist', text: 'WALL-E has a place in the room too. Say hello, then take a closer look at his little plant. A mechanical character can still feel curious and warm. Sometimes a raised arm and a change of gaze are all the introduction you need.' },
    ], note: 'Field note 05: there is always room for one more leaf.',
  },
  {
    section: 'The back page', title: 'See you around.', subtitle: 'The paper ends. The room is still yours.', art: 'record',
    caption: 'Put the paper down whenever you are ready.',
    articles: [
      { title: 'Classifieds', text: 'WANTED: one good idea, slightly unusual. Experience in surviving a blank canvas preferred. FOUND: a quiet corner, a warm record and several unfinished thoughts. No reward necessary.' },
      { title: 'The desk forecast', text: 'Scattered sketches, with a chance of another iteration. Visibility improves after a short break. Expect occasional music and a robot waving hello. Tomorrow’s outlook: still making things.' },
      { title: 'One last observation', text: 'You do not have to inspect every object to get the picture. A few details are enough to make a place feel like someone belongs there. Thanks for spending a moment in this one.' },
    ], note: 'The Lab Post · An original studio zine · Three sheets, six sides · End of edition',
  },
] as const;
