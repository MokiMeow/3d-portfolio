import type { RecentCall, Voicemail } from './histories';
export const phoneHistories: { recents: RecentCall[]; voicemails: Voicemail[] } = {
  "recents": [
    {
      "name": "Amma",
      "missed": true,
      "label": "10:42",
      "detail": "mobile · missed call · call when free"
    },
    {
      "name": "Amma",
      "missed": true,
      "label": "10:40",
      "detail": "mobile · missed call"
    },
    {
      "name": "Amma",
      "missed": true,
      "label": "10:38",
      "detail": "mobile · missed call"
    },
    {
      "name": "Spam Likely",
      "missed": true,
      "label": "10:17",
      "detail": "unknown · declined"
    },
    {
      "name": "Delivery",
      "missed": false,
      "label": "09:56",
      "detail": "incoming · 2 min · gate navigation"
    },
    {
      "name": "College Gang",
      "missed": false,
      "label": "Yesterday",
      "detail": "group audio · 47 min · 11 min of hellos"
    },
    {
      "name": "Chai Hotline",
      "missed": false,
      "label": "Yesterday",
      "detail": "outgoing · 3 min · kettle status"
    },
    {
      "name": "Landlord (rent)",
      "missed": true,
      "label": "Yesterday",
      "detail": "mobile · gentle missed reminder"
    },
    {
      "name": "Rubber Duck",
      "missed": false,
      "label": "Yesterday",
      "detail": "outgoing · 8 min · mostly listening"
    },
    {
      "name": "Do Not Answer",
      "missed": true,
      "label": "Monday",
      "detail": "unknown · warranty monologue avoided"
    },
    {
      "name": "Pizza",
      "missed": false,
      "label": "Monday",
      "detail": "incoming · 1 min · small bell located"
    },
    {
      "name": "Amma",
      "missed": false,
      "label": "Monday",
      "detail": "incoming · 12 min · food discussed"
    },
    {
      "name": "Gym Bros (Inactive)",
      "missed": true,
      "label": "Sunday",
      "detail": "group audio · nobody found the shoes"
    },
    {
      "name": "Delivery",
      "missed": true,
      "label": "Sunday",
      "detail": "incoming · wrong gate, right intentions"
    },
    {
      "name": "College Gang",
      "missed": false,
      "label": "Saturday",
      "detail": "group audio · 19 min · reunion planning"
    },
    {
      "name": "Spam Likely",
      "missed": true,
      "label": "Saturday",
      "detail": "unknown · extended imaginary warranty"
    },
    {
      "name": "Chai Hotline",
      "missed": false,
      "label": "9 Oct",
      "detail": "outgoing · 4 min · biscuits approved"
    },
    {
      "name": "Landlord (rent)",
      "missed": false,
      "label": "8 Oct",
      "detail": "incoming · 6 min · tap plot resolved"
    },
    {
      "name": "Rubber Duck",
      "missed": false,
      "label": "7 Oct",
      "detail": "outgoing · 9 min · quack with context"
    },
    {
      "name": "Pizza",
      "missed": false,
      "label": "6 Oct",
      "detail": "incoming · 2 min · emergency cheese services"
    },
    {
      "name": "Mom’s Cousin",
      "missed": false,
      "label": "5 Oct",
      "detail": "incoming · 14 min · eight blank pages"
    },
    {
      "name": "Unknown Number",
      "missed": true,
      "label": "4 Oct",
      "detail": "mobile · accidental cake consultant"
    }
  ],
  "voicemails": [
    {
      "id": "amma",
      "name": "Amma",
      "date": "Today · 10:42",
      "duration": "0:23",
      "lines": [
        "Nothing urgent. I called to say nothing urgent.",
        "Now you can stop imagining something urgent.",
        "Eat, and call when free. In that order."
      ]
    },
    {
      "id": "spam",
      "name": "Spam Likely",
      "date": "Today · 10:17",
      "duration": "0:41",
      "lines": [
        "Hello, your imaginary warranty is approaching an imaginary expiry.",
        "It covers everything except things that happen.",
        "Press one to hear this sentence again with more confidence."
      ]
    },
    {
      "id": "delivery",
      "name": "Delivery",
      "date": "Today · 09:56",
      "duration": "0:18",
      "lines": [
        "Sir, I am at the gate with a gate.",
        "There is a plant. I realise that is not helpful.",
        "Please call. Food and I would both like closure."
      ]
    },
    {
      "id": "college",
      "name": "College Gang",
      "date": "Yesterday · 20:08",
      "duration": "0:36",
      "lines": [
        "Rohan: We tried a group call. First eleven minutes were hello.",
        "Sneha: Saturday lunch is real. No poll is coming.",
        "Vishal: Cat declined. We saved a seat anyway."
      ]
    },
    {
      "id": "landlord",
      "name": "Landlord (rent)",
      "date": "Yesterday · 11:07",
      "duration": "0:29",
      "lines": [
        "A gentle reminder. This is the voicemail edition.",
        "Lift notice says 11 to 1, subject to 2.",
        "The plant is doing well. That part has no conditions."
      ]
    },
    {
      "id": "duck",
      "name": "Rubber Duck",
      "date": "Monday · 16:21",
      "duration": "0:12",
      "lines": [
        "Quack.",
        "Translation: expected result first, panic second.",
        "Actually, skip the panic. Take a small break."
      ]
    },
    {
      "id": "cousin",
      "name": "Mom’s Cousin",
      "date": "Sunday · 15:02",
      "duration": "0:31",
      "lines": [
        "Printer worked. Thank you. Only eight blank pages.",
        "The recipe finally printed. I can now cook from paper.",
        "One small thing: the printed page has no scroll button."
      ]
    },
    {
      "id": "chai",
      "name": "Chai Hotline",
      "date": "Saturday · 16:04",
      "duration": "0:16",
      "lines": [
        "Kettle operational. Biscuit reserves moderately optimistic.",
        "We saved a corner bajji for whoever is late.",
        "No meeting. Just come when you can."
      ]
    },
    {
      "id": "gym",
      "name": "Gym Bros (Inactive)",
      "date": "3 January · 06:05",
      "duration": "0:22",
      "lines": [
        "Arjun: Where is everyone?",
        "Nikhil: My alarm did not go off emotionally.",
        "Coach Sid: Start with ten minutes. We can retire the speeches."
      ]
    }
  ]
};
