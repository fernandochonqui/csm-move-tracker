
import { RubricCategory } from './types';

export const MOVE_RUBRIC: RubricCategory[] = [
  {
    id: 'discovery',
    title: 'Discovery Quality',
    subtitle: 'How deep did we dig?',
    question: 'Did the CSM use open-ended, second-level questioning to uncover the root cause, rather than relying on a "checklist" interrogation style?',
    levels: [
      {
        value: 1,
        description: 'The CSM adopted an "interrogation" style. They relied on rapid-fire, closed-ended (Yes/No) questions to fill out a form rather than having a conversation.'
      },
      {
        value: 2,
        description: 'The CSM asked basic open-ended questions ("What is your process?") but accepted the first answer given. They did not probe for specific examples or details.'
      },
      {
        value: 3,
        description: 'The CSM used follow-up prompts effectively (e.g., "Tell me more about that" or "Why is that important?"), moving beyond the surface but missing the emotional or personal context.'
      },
      {
        value: 4,
        description: 'The CSM "peeled the onion." They used the customer\'s previous answer to frame the next question, utilizing silence and "TED" (Tell, Explain, Describe) prompts to uncover the true root cause and personal context.'
      }
    ]
  },
  {
    id: 'motivation',
    title: 'M - Motivation',
    subtitle: 'Why Now?',
    question: 'Did the CSM successfully uncover the "trigger" behind the conversation and distinguish between Interest (curiosity) and Intent (urgency)?',
    levels: [
      {
        value: 1,
        description: 'The CSM treated the conversation as generic exploration. They did not ask "Why now?" or missed obvious timeline clues (e.g., "audit coming up," "Q1 rollout").'
      },
      {
        value: 2,
        description: 'The CSM asked why the customer was reaching out but accepted surface-level answers (e.g., "We just want to clean things up") without probing for the underlying driver.'
      },
      {
        value: 3,
        description: 'The CSM identified the trigger but did not clearly distinguish if it was just Interest or true Intent. They moved the conversation forward without confirming urgency.'
      },
      {
        value: 4,
        description: 'The CSM clearly distinguished Interest ❄️ vs. Intent 🔥. They uncovered the specific event driving the timeline (e.g., "We need this before the Q1 kickoff") and transitioned the conversation based on that urgency.'
      }
    ]
  },
  {
    id: 'opportunity',
    title: 'O - Opportunity',
    subtitle: 'What’s the Impact?',
    question: 'Did the CSM connect the customer’s change/request to a measurable business outcome, KPI, or specific problem?',
    levels: [
      {
        value: 1,
        description: 'The CSM focused solely on features ("show-and-tell"). They explained how a feature works but never asked why the customer needed it or what problem it solved.'
      },
      {
        value: 2,
        description: 'The CSM asked high-level questions about the problem ("Would this help you?") but failed to quantify the impact or importance of solving it.'
      },
      {
        value: 3,
        description: 'The CSM identified the pain point but stopped short of connecting it to a business metric (e.g., "It will save time," but not "It will save 10 hours/week").'
      },
      {
        value: 4,
        description: 'The CSM connected the trigger to a measurable outcome (ROI, Risk, Efficiency). They asked high-value questions like, "If you hit that goal, what kind of impact would it have on the business?" or "if we were able to solve this, how would that impact your team?"'
      }
    ]
  },
  {
    id: 'validation',
    title: 'V - Validation',
    subtitle: 'Who needs to believe?',
    question: 'Did the CSM identify the decision-makers, champions, and the internal steps required for approval?',
    levels: [
      {
        value: 1,
        description: 'The CSM assumed the person on the call was the sole decision-maker. No attempt was made to "multi-thread" or ask about other stakeholders.'
      },
      {
        value: 2,
        description: 'The CSM asked a binary question like "Do you need to check with anyone?" but didn\'t explore the criteria those people care about.'
      },
      {
        value: 3,
        description: 'The CSM identified who else needs to be involved (e.g., "I need to ask my VP") but did not arm the champion with the right data to win them over.'
      },
      {
        value: 4,
        description: 'The CSM mapped the buying committee and their specific needs. They asked questions like, "What would give your Ops Director confidence?" or "Who else needs to see results to be confident it\'s worth doing?"'
      }
    ]
  },
  {
    id: 'execution',
    title: 'E - Execution',
    subtitle: 'What’s Next?',
    question: 'Did the CSM turn alignment into action by securing a firm commitment and clear next steps?',
    levels: [
      {
        value: 1,
        description: 'The CSM ended with a passive "Let me know" or "Send me some info." No concrete next step was established. If there is no next step, it is still just Interest.'
      },
      {
        value: 2,
        description: 'The CSM suggested a next step ("Let\'s meet next week") but did not define an agenda or confirm if the timeline matched the customer\'s urgency.'
      },
      {
        value: 3,
        description: 'The CSM secured a meeting and an agenda, but failed to involve the necessary stakeholders identified in the Validation stage.'
      },
      {
        value: 4,
        description: 'The CSM aligned the next step specifically to the customer\'s timeline and goals. They secured a commitment (e.g., "Since you need this live by Q1, let\'s meet Tuesday to finalize the scope") and confirmed who should attend.'
      }
    ]
  }
];
