import type { AiHistory } from './histories';
export const aiHistories: Record<'chatgpt' | 'claude' | 'grok', AiHistory[]> = {
  "chatgpt": [
    {
      "id": -1,
      "title": "Name my startup",
      "turns": [
        {
          "from": "me",
          "text": "Name an app that reminds me to close tabs."
        },
        {
          "from": "bot",
          "text": "Here are three: TabNap, Close Enough, and LaterLoop. Each implies a gentle nudge, rather than a productivity sermon."
        },
        {
          "from": "me",
          "text": "Something less corporate."
        },
        {
          "from": "bot",
          "text": "Try Shoo. Short, friendly, and exactly what you say to the seventh unnecessary tab."
        },
        {
          "from": "me",
          "text": "One last option."
        },
        {
          "from": "bot",
          "text": "OneTabLeft. It sounds optimistic, which is a useful quality for a fictional tab-closing app."
        }
      ]
    },
    {
      "id": -2,
      "title": "Is a hotdog a sandwich (2am)",
      "turns": [
        {
          "from": "me",
          "text": "Is a hotdog a sandwich? It is 2am."
        },
        {
          "from": "bot",
          "text": "Under a broad bread-and-filling definition, yes. Under a hotdog-specific definition, it keeps its own tiny category. Both sides may now eat."
        },
        {
          "from": "me",
          "text": "What about a dosa?"
        },
        {
          "from": "bot",
          "text": "A folded dosa tests whether your definition cares about bread or about structure. This is why food taxonomy should come with chutney."
        },
        {
          "from": "me",
          "text": "We should sleep."
        },
        {
          "from": "bot",
          "text": "Agreed. No sandwich classification becomes more useful after your third yawn. Save the debate, drink water, sleep."
        }
      ]
    },
    {
      "id": -3,
      "title": "Rewrite this email to sound less angry",
      "turns": [
        {
          "from": "me",
          "text": "Rewrite: As I already said THREE TIMES, read the doc."
        },
        {
          "from": "bot",
          "text": "Could you check the notes in the doc before we continue? They cover the current approach and should answer the open questions."
        },
        {
          "from": "me",
          "text": "Less passive-aggressive, please."
        },
        {
          "from": "bot",
          "text": "Please take a look at the doc when you have a moment. If anything is unclear, let me know which part and I can clarify."
        },
        {
          "from": "me",
          "text": "Add one warm closing line."
        },
        {
          "from": "bot",
          "text": "Thanks for taking the time to check. I appreciate it. The capitals have now been safely escorted out."
        }
      ]
    },
    {
      "id": -4,
      "title": "Debug: works on my machine",
      "turns": [
        {
          "from": "me",
          "text": "It works on my machine and fails in the imaginary CI."
        },
        {
          "from": "bot",
          "text": "Compare inputs, environment, clock, and dependencies. Start with the smallest difference you can observe. Your laptop is a witness, not a guarantee."
        },
        {
          "from": "me",
          "text": "The test uses Date.now()."
        },
        {
          "from": "bot",
          "text": "That is a concrete clue. Use a controlled clock in the test so the expected result does not depend on when the fictional runner wakes up."
        },
        {
          "from": "me",
          "text": "So retrying it five times was not a fix?"
        },
        {
          "from": "bot",
          "text": "It demonstrated variability. A fix should remove the uncontrolled dependency and make failure meaningful. The fifth green run was just wearing a reassuring hat."
        }
      ]
    },
    {
      "id": -5,
      "title": "Can I replace every meeting with chai?",
      "turns": [
        {
          "from": "me",
          "text": "Can I replace every meeting with chai?"
        },
        {
          "from": "bot",
          "text": "Some meetings can become short messages. Chai can support the conversations that remain. Please do not dunk a pending decision into the kettle."
        },
        {
          "from": "me",
          "text": "What about an actual decision?"
        },
        {
          "from": "bot",
          "text": "Write the question, options, and decision owner first. Meet only if the discussion helps reach the decision faster."
        },
        {
          "from": "me",
          "text": "What about a status update?"
        },
        {
          "from": "bot",
          "text": "Usually one clear message: what changed, what is next, and what needs help. Biscuit appendix optional."
        }
      ]
    },
    {
      "id": -6,
      "title": "Explain taxes to a rubber duck",
      "turns": [
        {
          "from": "me",
          "text": "Explain taxes to a rubber duck. No advice, just the idea."
        },
        {
          "from": "bot",
          "text": "At a very general level, taxes are contributions collected to support shared public services. This is a fictional explanation, not guidance for filing."
        },
        {
          "from": "me",
          "text": "And paperwork?"
        },
        {
          "from": "bot",
          "text": "Paperwork describes the relevant activity so the contribution can be worked out under the applicable rules. Our duck only needs the concept today."
        },
        {
          "from": "me",
          "text": "The duck has fallen asleep."
        },
        {
          "from": "bot",
          "text": "Then the explanation was enough. We can leave the real rules to a qualified source and let the duck keep its nap."
        }
      ]
    },
    {
      "id": -7,
      "title": "Make a Goa plan that happens",
      "turns": [
        {
          "from": "me",
          "text": "Make a Goa plan that actually happens."
        },
        {
          "from": "bot",
          "text": "Choose one weekend, confirm real availability, agree a budget, and give one person responsibility for the next booking step. Avoid an infinite date poll."
        },
        {
          "from": "me",
          "text": "Six people. Six calendars."
        },
        {
          "from": "bot",
          "text": "Ask for yes or no on one proposed weekend by one deadline. If it does not fit, make a smaller plan. A group description is not a reservation."
        },
        {
          "from": "me",
          "text": "We ended up choosing local lunch."
        },
        {
          "from": "bot",
          "text": "That counts. You converted a decorative plan into time together. The ocean will still be there for a later story."
        }
      ]
    },
    {
      "id": -8,
      "title": "One more quick change",
      "turns": [
        {
          "from": "me",
          "text": "It is only one more button."
        },
        {
          "from": "bot",
          "text": "Start with the action it serves and the decision the visitor makes. Button count is a weak estimate of behaviour count."
        },
        {
          "from": "me",
          "text": "And a modal. And permissions."
        },
        {
          "from": "bot",
          "text": "That is now several behaviours. Name the required one and defer the others until they answer an actual need."
        },
        {
          "from": "me",
          "text": "How do I keep it small?"
        },
        {
          "from": "bot",
          "text": "Make one complete path work clearly. The best small change has a small explanation, not just a small icon."
        }
      ]
    }
  ],
  "claude": [
    {
      "id": -1,
      "title": "Name my startup",
      "turns": [
        {
          "from": "me",
          "text": "Name an app that reminds me to close tabs."
        },
        {
          "from": "bot",
          "text": "I rather like Close Enough, although it could be mistaken for an app that encourages giving up. TabGarden is gentler: prune what you do not need."
        },
        {
          "from": "me",
          "text": "Something less corporate."
        },
        {
          "from": "bot",
          "text": "Shoo is charming. It asks a tab to leave with the firmness of someone rescuing a biscuit from tea."
        },
        {
          "from": "me",
          "text": "One last option."
        },
        {
          "from": "bot",
          "text": "Perhaps Quiet Browser. A name that promises less is refreshingly honest. These are fictional suggestions, not a trademark check."
        }
      ]
    },
    {
      "id": -2,
      "title": "Is a hotdog a sandwich (2am)",
      "turns": [
        {
          "from": "me",
          "text": "Is a hotdog a sandwich? It is 2am."
        },
        {
          "from": "bot",
          "text": "I would first ask which definition matters. For ordering lunch, hotdog is already precise enough. For an argument at 2am, definitions will only grow more elaborate."
        },
        {
          "from": "me",
          "text": "What about a dosa?"
        },
        {
          "from": "bot",
          "text": "Dosa might be a better reason to stop classifying and start eating. I would keep the chutney out of the ontology."
        },
        {
          "from": "me",
          "text": "We should sleep."
        },
        {
          "from": "bot",
          "text": "A sensible conclusion. We arrived at rest without forcing lunch into a philosophical filing cabinet."
        }
      ]
    },
    {
      "id": -3,
      "title": "Rewrite this email to sound less angry",
      "turns": [
        {
          "from": "me",
          "text": "Rewrite: As I already said THREE TIMES, read the doc."
        },
        {
          "from": "bot",
          "text": "Would you mind checking the doc before we pick this up again? It captures the approach we agreed, and I am happy to clarify anything missing."
        },
        {
          "from": "me",
          "text": "Less passive-aggressive, please."
        },
        {
          "from": "bot",
          "text": "Please have a look at the doc when convenient. Let me know if a specific point needs more explanation. This keeps the request without the implied sigh."
        },
        {
          "from": "me",
          "text": "Add one warm closing line."
        },
        {
          "from": "bot",
          "text": "Thanks for helping us keep the discussion clear. Warm enough, I think, without making a frustrated email wear a party hat."
        }
      ]
    },
    {
      "id": -4,
      "title": "Debug: works on my machine",
      "turns": [
        {
          "from": "me",
          "text": "It works on my machine and fails in the imaginary CI."
        },
        {
          "from": "bot",
          "text": "What differs between those two environments? I would compare one failing run with one passing run and resist changing several things at once."
        },
        {
          "from": "me",
          "text": "The test uses Date.now()."
        },
        {
          "from": "bot",
          "text": "Then time is an input, even if the test treats it as scenery. Make that input explicit with a controlled clock."
        },
        {
          "from": "me",
          "text": "So retrying it five times was not a fix?"
        },
        {
          "from": "bot",
          "text": "Retrying can give evidence that the failure varies. It cannot explain why. The useful next step is the smallest change that removes that variation."
        }
      ]
    },
    {
      "id": -5,
      "title": "Can I replace every meeting with chai?",
      "turns": [
        {
          "from": "me",
          "text": "Can I replace every meeting with chai?"
        },
        {
          "from": "bot",
          "text": "I suspect you could replace many with a thoughtful note. Chai is a pleasant companion, but it is not obliged to become project management software."
        },
        {
          "from": "me",
          "text": "What about an actual decision?"
        },
        {
          "from": "bot",
          "text": "A short conversation can help if the trade-offs need discussion. State the decision first so nobody has to discover it after the tea cools."
        },
        {
          "from": "me",
          "text": "What about a status update?"
        },
        {
          "from": "bot",
          "text": "A concise written update is often kinder to everyone’s attention. Leave room for questions. Leave more room for lunch."
        }
      ]
    },
    {
      "id": -6,
      "title": "Explain taxes to a rubber duck",
      "turns": [
        {
          "from": "me",
          "text": "Explain taxes to a rubber duck. No advice, just the idea."
        },
        {
          "from": "bot",
          "text": "Imagine a shared pond that needs looking after. A general contribution helps support shared services. The metaphor explains the idea, not any particular tax rule."
        },
        {
          "from": "me",
          "text": "And paperwork?"
        },
        {
          "from": "bot",
          "text": "The forms help describe what happened so the applicable rules can be used. I would not ask our pretend duck to infer a real filing obligation from a pond metaphor."
        },
        {
          "from": "me",
          "text": "The duck has fallen asleep."
        },
        {
          "from": "bot",
          "text": "That seems a good stopping point. A gentle concept is enough; a sleeping duck is not requesting a compliance seminar."
        }
      ]
    },
    {
      "id": -7,
      "title": "Make a Goa plan that happens",
      "turns": [
        {
          "from": "me",
          "text": "Make a Goa plan that actually happens."
        },
        {
          "from": "bot",
          "text": "I would make the first plan modest: one weekend, one budget range, and a real yes or no from each person. Optimism is lovely but poor at holding train seats."
        },
        {
          "from": "me",
          "text": "Six people. Six calendars."
        },
        {
          "from": "bot",
          "text": "Give the group a deadline and accept that a smaller gathering is still a gathering. Calendars do not become compatible through group-name confidence."
        },
        {
          "from": "me",
          "text": "We ended up choosing local lunch."
        },
        {
          "from": "bot",
          "text": "That sounds rather good. The aim was time together, and lunch does that without requiring six packed bags."
        }
      ]
    },
    {
      "id": -8,
      "title": "One more quick change",
      "turns": [
        {
          "from": "me",
          "text": "It is only one more button."
        },
        {
          "from": "bot",
          "text": "I would start with what the button allows someone to do. A tiny shape can open a surprisingly large set of promises."
        },
        {
          "from": "me",
          "text": "And a modal. And permissions."
        },
        {
          "from": "bot",
          "text": "Then the useful question is which promise is essential now. The rest can wait until someone actually needs it."
        },
        {
          "from": "me",
          "text": "How do I keep it small?"
        },
        {
          "from": "bot",
          "text": "Keep a complete, understandable action. Smallness is something a visitor should feel, not a number in the diff."
        }
      ]
    }
  ],
  "grok": [
    {
      "id": -1,
      "title": "Name my startup",
      "turns": [
        {
          "from": "me",
          "text": "Name an app that reminds me to close tabs."
        },
        {
          "from": "bot",
          "text": "Tabitha. It sounds like someone who will politely ask why you need 46 copies of the same documentation."
        },
        {
          "from": "me",
          "text": "Something less corporate."
        },
        {
          "from": "bot",
          "text": "Shoo. A product name and a complete product strategy in four letters."
        },
        {
          "from": "me",
          "text": "One last option."
        },
        {
          "from": "bot",
          "text": "Close Enough. Your browser has requested a boundary and a nap."
        }
      ]
    },
    {
      "id": -2,
      "title": "Is a hotdog a sandwich (2am)",
      "turns": [
        {
          "from": "me",
          "text": "Is a hotdog a sandwich? It is 2am."
        },
        {
          "from": "bot",
          "text": "At 2am everything is a sandwich if your confidence is irresponsible enough. Define bread first. Then define bedtime."
        },
        {
          "from": "me",
          "text": "What about a dosa?"
        },
        {
          "from": "bot",
          "text": "Dosa is busy being delicious. It has declined your category meeting."
        },
        {
          "from": "me",
          "text": "We should sleep."
        },
        {
          "from": "bot",
          "text": "Finally, a defensible conclusion. The sandwich committee is adjourned due to pillows."
        }
      ]
    },
    {
      "id": -3,
      "title": "Rewrite this email to sound less angry",
      "turns": [
        {
          "from": "me",
          "text": "Rewrite: As I already said THREE TIMES, read the doc."
        },
        {
          "from": "bot",
          "text": "Please read the doc before we continue. It has the details. I have removed the verbal table-flip for you."
        },
        {
          "from": "me",
          "text": "Less passive-aggressive, please."
        },
        {
          "from": "bot",
          "text": "Please check the doc when you have a moment and flag any unclear points. There. The keyboard is no longer radiating steam."
        },
        {
          "from": "me",
          "text": "Add one warm closing line."
        },
        {
          "from": "bot",
          "text": "Thanks for taking a look. Simple. No need to finish with a suspiciously cheerful exclamation-mark parade."
        }
      ]
    },
    {
      "id": -4,
      "title": "Debug: works on my machine",
      "turns": [
        {
          "from": "me",
          "text": "It works on my machine and fails in the imaginary CI."
        },
        {
          "from": "bot",
          "text": "Your machine is a very biased reviewer. Compare the actual inputs and environment before issuing it a medal."
        },
        {
          "from": "me",
          "text": "The test uses Date.now()."
        },
        {
          "from": "bot",
          "text": "The clock is a secret parameter. Stop letting the test negotiate with Tuesday. Give it a fixed time."
        },
        {
          "from": "me",
          "text": "So retrying it five times was not a fix?"
        },
        {
          "from": "bot",
          "text": "It was a confidence ritual with a green tick at the end. Now make the result deterministic and earn the tick."
        }
      ]
    },
    {
      "id": -5,
      "title": "Can I replace every meeting with chai?",
      "turns": [
        {
          "from": "me",
          "text": "Can I replace every meeting with chai?"
        },
        {
          "from": "bot",
          "text": "Replace the unnecessary ones with messages. Keep the useful ones short. Chai is infrastructure, but it should not be forced to minute every meeting."
        },
        {
          "from": "me",
          "text": "What about an actual decision?"
        },
        {
          "from": "bot",
          "text": "Name the decision before inviting eight people to orbit it. A conversation is useful when something changes afterward."
        },
        {
          "from": "me",
          "text": "What about a status update?"
        },
        {
          "from": "bot",
          "text": "Put it in writing. Three clear lines beat 40 minutes of everyone saying yesterday in a different tone."
        }
      ]
    },
    {
      "id": -6,
      "title": "Explain taxes to a rubber duck",
      "turns": [
        {
          "from": "me",
          "text": "Explain taxes to a rubber duck. No advice, just the idea."
        },
        {
          "from": "bot",
          "text": "Shared services need shared funding. Taxes are one way that is collected under rules. Our fictional duck has received a concept, not filing advice."
        },
        {
          "from": "me",
          "text": "And paperwork?"
        },
        {
          "from": "bot",
          "text": "Forms are where the concept puts on office shoes. The real rules need a real qualified source; this duck has no accountant costume."
        },
        {
          "from": "me",
          "text": "The duck has fallen asleep."
        },
        {
          "from": "bot",
          "text": "Correct duck response. Never wake a rubber duck for an unsolicited spreadsheet."
        }
      ]
    },
    {
      "id": -7,
      "title": "Make a Goa plan that happens",
      "turns": [
        {
          "from": "me",
          "text": "Make a Goa plan that actually happens."
        },
        {
          "from": "bot",
          "text": "Step one: stop treating Confirmed 100% as a ticket. Step two: choose one date and get actual yeses. Step three: do the next real step."
        },
        {
          "from": "me",
          "text": "Six people. Six calendars."
        },
        {
          "from": "bot",
          "text": "Six calendars have entered. One weekend may leave. Set a deadline before the poll grows a sequel."
        },
        {
          "from": "me",
          "text": "We ended up choosing local lunch."
        },
        {
          "from": "bot",
          "text": "Congratulations. You visited a place outside the group description. Lunch wins by showing up."
        }
      ]
    },
    {
      "id": -8,
      "title": "One more quick change",
      "turns": [
        {
          "from": "me",
          "text": "It is only one more button."
        },
        {
          "from": "bot",
          "text": "A button is a tiny door. Ask what is behind it before announcing the renovation is small."
        },
        {
          "from": "me",
          "text": "And a modal. And permissions."
        },
        {
          "from": "bot",
          "text": "Behind this door is a whole airport. Pick the one route someone needs today."
        },
        {
          "from": "me",
          "text": "How do I keep it small?"
        },
        {
          "from": "bot",
          "text": "One clear action. One clear outcome. Let the future modal find its own meeting invite."
        }
      ]
    }
  ]
};
