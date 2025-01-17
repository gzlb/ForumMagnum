import { ABTest, useABTest, useABTestProperties } from './abTestImpl';
export { useABTest, useABTestProperties };

// An A/B test which doesn't do anything (other than randomize you), for testing
// the A/B test infrastructure.
export const noEffectABTest = new ABTest({
  name: "abTestNoEffect",
  description: "A placeholder A/B test which has no effect",
  groups: {
    group1: {
      description: "The smaller test group",
      weight: 1,
    },
    group2: {
      description: "The larger test group",
      weight: 2,
    },
  }
});

// A/B test for the new CollectionsPage
export const collectionsPageABTest = new ABTest({
  name: "collectionsPageABTest",
  description: "Tests the new LargeSequencesItem on the CollectionsPage",
  groups: {
    originalLayoutGroup: {
      description: "Group with old layout (SequencesGridItem)",
      weight: 1,
    },
    largeSequenceItemGroup: {
      description: "Group using LargeSequencesItem",
      weight: 1,
    },
  }
});

// A/B test for the new BooksProgressBar
export const booksProgressBarABTest = new ABTest({
  name: "booksProgressBarABTest",
  description: "Tests the new BooksProgressBar, as used in BooksItem (itself used in CollectionsPage)",
  groups: {
    control: {
      description: "Original BooksItem without the progress bar",
      weight: 1
    },
    progressBar: {
      description: "Progress bar enabled",
      weight: 1
    }
  }
});

export const welcomeBoxABTest = new ABTest({
  name: "welcomeBoxABTest",
  description: "Tests the new Welcome Box on post pages for logged out users",
  groups: {
    control: {
      description: "Don't show Welcome Box on post pages",
      weight: 1
    },
    welcomeBox: {
      description: "Show Welcome Box on post pages",
      weight: 1
    }
  }
});

export const twoLineEventsSidebarABTest = new ABTest({
  name: "twoLineEventsSidebar",
  description: "Events sidebar shows more information",
  groups: {
    control: {
      description: "One line per event",
      weight: 1,
    },
    expanded: {
      description: "Two lines per event",
      weight: 1,
    },
  },
});

// not active anymore since picked the best option, but leaving around as a record of AB tests that were previously run
export const dialogueFacilitationMessagesABTest = new ABTest({
  name: "dialogueFacilitationMessages",
  description: "Different wording",
  groups: {
    getHelp: {
      description: "Get help version",
      weight: 1,
    },
    optIn: {
      description: "Opt-in version",
      weight: 1,
    },
  },
});

export const frontpageDialogueReciprocityRecommendations = new ABTest({
  name: "frontpageDialogueReciprocityRecommendations",
  description: "Show frontpage reciprocity recommendations or not",
  groups: {
    show: {
      description: "Show on frontpage",
      weight: 1,
    },
    noShow: {
      description: "Don't show",
      weight: 1,
    },
  },
});

export const showTopicsInReciprocity = new ABTest({
  name: "showOpinionsInReciprocity",
  description: "Show suggested topics in the reciprocity dialogue frontpage suggestions",
  groups: {
    show: {
      description: "Show topics",
      weight: 2,
    },
    noShow: {
      description: "Don't show topics",
      weight: 1,
    },
  },
});

// Does non-SSR rendering of the DialogueMatchingPage help with anything?
export const dialogueMatchingPageNoSSRABTest = new ABTest({
  name: "dialogueMatchingPageNoSSR",
  description: "Different rendering of the DialogueMatchingPage",
  groups: {
    control: {
      description: "Control version",
      weight: 1,
    },
    noSSR: {
      description: "Non-SSR version",
      weight: 1,
    },
  },
});

// Does showing people recommended content in the form increase conversion ratio?
export const showRecommendedContentInMatchForm = new ABTest({
  name: "showRecommendedContentInMatchForm",
  description: "Include a little card in the dialogue matchmaking form that lists a matched user's recent comments and posts, and potentially other user content",
  groups: {
    show: {
      description: "Show",
      weight: 1,
    },
    noShow: {
      description: "Don't show",
      weight: 1,
    },
  },
});

export const checkNotificationMessageContent = new ABTest({
  name: "checkNotificationMessageContent",
  description: "Send different wording of the notification message upon a user receiving new checks",
  groups: {
    v1: {
      description: "Wording version 1",
      weight: 1,
    },
    v2: {
      description: "Wording version 2",
      weight: 1,
    },
    v3: {
      description: "Wording version 3",
      weight: 1,
    },
    v4: {
      description: "Wording version 4",
      weight: 1,
    },
  },
});

export const offerToAddCalendlyLink = new ABTest({
  name: "offerToAddCalendlyLink",
  description: "Offer to add a Calendly link on dialogue match",
  groups: {
    show: {
      description: "Show field",
      weight: 2,
    },
    noShow: {
      description: "Don't show field",
      weight: 1,
    },
  },
});
