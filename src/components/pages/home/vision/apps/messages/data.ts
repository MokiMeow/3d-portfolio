import type { Conversation } from './types';

const seeds = [
  {
    "id": 1,
    "name": "Build Bot",
    "glyph": "▣",
    "tint": "#9bb9d9",
    "description": "Online · cautiously optimistic",
    "messages": [
      {
        "id": 1,
        "text": "Build finished. Emotionally, I have not.",
        "mine": false
      },
      {
        "id": 2,
        "text": "How many warnings?",
        "mine": true
      },
      {
        "id": 3,
        "text": "Let us call them suggestions.",
        "mine": false
      }
    ],
    "rules": [
      {
        "terms": [
          "build",
          "deploy"
        ],
        "reply": "Deploying confidence… confidence not found. Deploying anyway, in spirit."
      },
      {
        "terms": [
          "test",
          "pass"
        ],
        "reply": "All tests passed after I lowered their expectations. A promising strategy."
      },
      {
        "terms": [
          "bug",
          "error",
          "fail"
        ],
        "reply": "That is a feature with an unusually adventurous personality."
      },
      {
        "terms": [
          "chai",
          "tea",
          "coffee"
        ],
        "reply": "Build paused for chai. This is the most stable pipeline we have had."
      },
      {
        "terms": [
          "when",
          "time",
          "soon"
        ],
        "reply": "Estimated completion: after the last tiny change. There is always another tiny change."
      },
      {
        "terms": [
          "hello",
          "hi",
          "hey"
        ],
        "reply": "Hello. I have prepared a reassuring green rectangle for you."
      },
      {
        "terms": [
          "thanks",
          "thank"
        ],
        "reply": "You are welcome. Please express appreciation by committing your changes."
      }
    ],
    "fallback": [
      "Message received. Adding it to the backlog, where ideas get comfortable.",
      "I ran that through the pipeline. It came out as a warning.",
      "Have you tried a clean build and a reasonably warm cup of chai?"
    ]
  },
  {
    "id": 2,
    "name": "Rubber Duck",
    "glyph": "◔",
    "tint": "#e5cf8f",
    "description": "Listening · professionally",
    "messages": [
      {
        "id": 4,
        "text": "Tell me about the bug. Slowly. I have all the bath time in the world.",
        "mine": false
      }
    ],
    "rules": [
      {
        "terms": [
          "bug",
          "error",
          "broken"
        ],
        "reply": "Explain it once more. The answer usually appears halfway through the sentence."
      },
      {
        "terms": [
          "code",
          "function",
          "loop"
        ],
        "reply": "And what did you expect that line to do? I ask with my most supportive beak."
      },
      {
        "terms": [
          "why",
          "how"
        ],
        "reply": "An excellent question. Let us stare meaningfully at the same three lines."
      },
      {
        "terms": [
          "chai",
          "tea"
        ],
        "reply": "I cannot hold a cup, but I support this debugging technique."
      },
      {
        "terms": [
          "fixed",
          "works",
          "solved"
        ],
        "reply": "You did it. I contributed by remaining extremely yellow."
      },
      {
        "terms": [
          "hello",
          "hi",
          "hey"
        ],
        "reply": "Quack. That is both a greeting and an architecture review."
      },
      {
        "terms": [
          "tired",
          "sleep",
          "late"
        ],
        "reply": "Close the laptop. Even ducks believe in a sensible bedtime."
      }
    ],
    "fallback": [
      "Go on. I am listening with my entire rubber head.",
      "Have you checked the value before it becomes the other value?",
      "Sometimes the best fix is a short walk. I will supervise the desk."
    ]
  },
  {
    "id": 3,
    "name": "Amma",
    "glyph": "✿",
    "tint": "#d6b3cf",
    "description": "Available · for a gentle reminder",
    "messages": [
      {
        "id": 5,
        "text": "Had food? The computer can wait.",
        "mine": false
      },
      {
        "id": 6,
        "text": "Just finishing something.",
        "mine": true
      },
      {
        "id": 7,
        "text": "That is what you said before the last cup of chai.",
        "mine": false
      }
    ],
    "rules": [
      {
        "terms": [
          "food",
          "eat",
          "lunch",
          "dinner"
        ],
        "reply": "Good. Have something warm. Biscuits beside a keyboard are not a meal."
      },
      {
        "terms": [
          "work",
          "code",
          "build"
        ],
        "reply": "Finish the important bit, then take a break. The screen has been looking at you long enough."
      },
      {
        "terms": [
          "chai",
          "tea",
          "coffee"
        ],
        "reply": "One cup is lovely. A whole day made of cups is a different recipe."
      },
      {
        "terms": [
          "traffic",
          "late",
          "road"
        ],
        "reply": "Come slowly. Bengaluru will still be Bengaluru when you arrive."
      },
      {
        "terms": [
          "sleep",
          "tired",
          "night"
        ],
        "reply": "Keep the phone down for a little while. Even a developer has a sleep mode."
      },
      {
        "terms": [
          "hello",
          "hi",
          "hey"
        ],
        "reply": "Hello! Had food? Yes, this is still the first question."
      },
      {
        "terms": [
          "bug",
          "error",
          "problem"
        ],
        "reply": "Take a breath. And check if you have eaten before fixing the whole world."
      }
    ],
    "fallback": [
      "Okay. Drink some water also.",
      "I do not know what that means, but I am sure a small break will help.",
      "Very nice. Now tell me if you have had food."
    ]
  }
];

export function createConversations(): [Conversation, Conversation, Conversation, ...Conversation[]] {
  const chats = seeds.map((chat, index) => ({
    ...chat,
    members: [chat.name],
    pinned: index < 2,
    unread: index === 2 ? 1 : 0,
    muted: false,
    messages: chat.messages.map((message, position) => ({
      ...message,
      time: '09:' + String(20 + index * 10 + position * 2).padStart(2, '0'),
      status: message.mine ? 'read' : undefined,
    })),
  })) as [Conversation, Conversation, Conversation, ...Conversation[]];

  chats[0].messages.push({
    id: 8,
    text: 'A peaceful place to await the next warning.',
    mine: false,
    time: '09:28',
    photo: 'lakeside',
  });
  chats[1].messages.push({
    id: 9,
    text: 'An architecture review, condensed.',
    mine: false,
    time: '09:33',
    audio: true,
  });
  chats.push({
    id: 4,
    name: 'Chai & Debug',
    glyph: '☕',
    tint: '#f0bc86',
    description: '3 participants · one shared breakpoint',
    members: ['Build Bot', 'Rubber Duck', 'Amma'],
    pinned: false,
    unread: 2,
    muted: false,
    messages: [
      { id: 10, text: 'I made a group for the last tiny change.', mine: false, sender: 'Build Bot', time: '09:42' },
      { id: 11, text: 'I brought a supportive beak.', mine: false, sender: 'Rubber Duck', time: '09:43' },
      { id: 12, text: 'I brought food. Please prioritise correctly.', mine: false, sender: 'Amma', time: '09:44' },
    ],
    rules: [],
    fallback: [
      'Build Bot: The agenda has compiled. Rubber Duck would like to hear it explained slowly.',
      'Amma: A group chat is still not a lunch break. Drink some water also.',
      'Rubber Duck: We have reached consensus. Explain the bug one more time.',
    ],
  });
  return chats;
}

export const reactions = ['♥️', '👍', '😂', '‼️', '🤔', '☕'];
export const stickers = ['🦆', '☕', '🫶', '🎉', '🧠', '✨', '🍛', '🚀'];
export const photos = [
  { id: 'lakeside', name: 'Lakeside Sunrise' },
  { id: 'kiara', name: 'Kiara Dawn' },
  { id: 'mondello', name: 'Mondello Beach' },
  { id: 'pines', name: 'Misty Pines' },
];
export const waveform = Array.from({ length: 34 }, (_, index) => 8 + ((index * 17 + index * index * 7) % 30));
