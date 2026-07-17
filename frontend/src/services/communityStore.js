const STORAGE_VERSION = 1;
const TEST_BALANCE_VERSION = 4;
export const TEST_AGRI_POINT_BALANCE = 2000;

export const COMMUNITY_CROPS = ["All crops", "Paddy", "Chilli", "Durian", "Tomato", "Unknown crop"];
export const COMMUNITY_TOPICS = ["All topics", "Disease", "Pest", "Identification", "Soil", "Weather", "Marketplace"];

export const VOUCHER_TIERS = [
  { value: 1, cost: 100 },
  { value: 5, cost: 500 },
  { value: 10, cost: 1000 },
];

const seedQuestions = [
  {
    id: "community-paddy-brown-spots",
    title: "Brown spots appeared on paddy leaves after several wet days",
    crop: "Paddy",
    topic: "Disease",
    location: "Kedah",
    body: "The lower leaves developed small brown diamond-shaped spots after five days of rain. The affected area is spreading slowly. I have not applied any chemical treatment yet.",
    symptoms: "Brown diamond-shaped spots; five days; recent heavy rain",
    author: "Farid H.",
    authorEmail: "farid@example.com",
    authorLevel: "Grower",
    createdAt: "2026-07-13T08:20:00.000Z",
    status: "solved",
    helpfulCount: 24,
    meTooCount: 11,
    photoCount: 2,
    acceptedAnswerId: "answer-paddy-review",
    answers: [
      {
        id: "answer-paddy-review",
        author: "Dr. Aina Rahman",
        authorEmail: "aina.research@example.com",
        authorRole: "Verified Researcher",
        body: "The shape and wet-weather pattern are consistent with a possible leaf blast concern, but a photo alone is not enough for confirmation. Compare lesions on several plants, check whether the centres become grey, avoid unnecessary nitrogen application, and contact your local agriculture officer if the affected area expands quickly.",
        helpfulCount: 31,
        createdAt: "2026-07-13T11:10:00.000Z",
        accepted: true,
        researcherReviewed: true,
      },
      {
        id: "answer-paddy-field",
        author: "Pak Din",
        authorEmail: "pakdin@example.com",
        authorRole: "Trusted Contributor",
        body: "I had a similar pattern last season. Mark a few plants and photograph the same leaves each day. That made it easier for the extension officer to see whether the lesions were actually progressing.",
        helpfulCount: 12,
        createdAt: "2026-07-13T09:45:00.000Z",
        accepted: false,
        researcherReviewed: false,
      },
    ],
  },
  {
    id: "community-unknown-yellow-leaf",
    title: "Can someone identify this crop with yellow curling leaves?",
    crop: "Unknown crop",
    topic: "Identification",
    location: "Perak",
    body: "This plant is growing beside a small vegetable plot. The leaves started curling upward and turning yellow this week. I do not know the crop name, so I attached views of the whole plant and both sides of a leaf.",
    symptoms: "Yellow leaves; upward curl; crop unknown",
    author: "Mei Ling",
    authorEmail: "meiling@example.com",
    authorLevel: "Seedling",
    createdAt: "2026-07-15T09:05:00.000Z",
    status: "open",
    helpfulCount: 7,
    meTooCount: 3,
    photoCount: 3,
    acceptedAnswerId: null,
    answers: [
      {
        id: "answer-unknown-angles",
        author: "Kumar S.",
        authorEmail: "kumar@example.com",
        authorRole: "Helpful Contributor",
        body: "Could you add one photo of the stem and another showing any flower or fruit? Leaf shape alone may match several plants.",
        helpfulCount: 8,
        createdAt: "2026-07-15T10:30:00.000Z",
        accepted: false,
        researcherReviewed: false,
      },
    ],
  },
  {
    id: "community-chilli-whiteflies",
    title: "How do I inspect curled chilli leaves for whiteflies safely?",
    crop: "Chilli",
    topic: "Pest",
    location: "Johor",
    body: "Several young chilli leaves are curling. I want to check for whiteflies before deciding what action is needed. Where should I look and what should I record?",
    symptoms: "Young leaves curling; possible whiteflies",
    author: "Siti Mariam",
    authorEmail: "siti@example.com",
    authorLevel: "Helpful Contributor",
    createdAt: "2026-07-10T06:40:00.000Z",
    status: "solved",
    helpfulCount: 37,
    meTooCount: 18,
    photoCount: 1,
    acceptedAnswerId: "answer-chilli-inspect",
    answers: [
      {
        id: "answer-chilli-inspect",
        author: "Nurul F.",
        authorEmail: "nurul@example.com",
        authorRole: "Community Champion",
        body: "Check the underside of the youngest leaves early in the morning. Gently turn the leaf without crushing it and look for tiny pale insects, eggs, sticky residue, or sooty growth. Photograph what you see before taking action, and confirm the pest rather than treating leaf curl alone.",
        helpfulCount: 44,
        createdAt: "2026-07-10T07:15:00.000Z",
        accepted: true,
        researcherReviewed: false,
      },
    ],
  },
  {
    id: "community-durian-drainage",
    title: "Improving drainage around a young durian tree after flooding",
    crop: "Durian",
    topic: "Soil",
    location: "Pahang",
    body: "Water remained around two young trees for almost a day after a storm. The soil is still saturated. What observations should I make before changing the drainage channel?",
    symptoms: "Temporary flooding; saturated soil; young trees",
    author: "Azlan R.",
    authorEmail: "azlan@example.com",
    authorLevel: "Grower",
    createdAt: "2026-07-16T02:25:00.000Z",
    status: "open",
    helpfulCount: 3,
    meTooCount: 2,
    photoCount: 1,
    acceptedAnswerId: null,
    answers: [],
  },
  {
    id: "community-tomato-wilting",
    title: "Tomato plants wilt at noon but recover in the evening",
    crop: "Tomato",
    topic: "Weather",
    location: "Selangor",
    body: "The plants look healthy in the morning, wilt around noon, and recover after sunset. The soil surface feels dry but it is damp a few centimetres below.",
    symptoms: "Midday wilt; evening recovery; damp subsurface soil",
    author: "David L.",
    authorEmail: "david@example.com",
    authorLevel: "Grower",
    createdAt: "2026-07-14T04:05:00.000Z",
    status: "open",
    helpfulCount: 9,
    meTooCount: 6,
    photoCount: 0,
    acceptedAnswerId: null,
    answers: [
      {
        id: "answer-tomato-monitor",
        author: "Hafiz M.",
        authorEmail: "hafiz@example.com",
        authorRole: "Helpful Contributor",
        body: "Record soil moisture and whether only the newest growth wilts. Recovery at night can be heat-related, but inspect roots and stems before assuming that is the only cause.",
        helpfulCount: 6,
        createdAt: "2026-07-14T05:30:00.000Z",
        accepted: false,
        researcherReviewed: false,
      },
    ],
  },
];

const initialLedger = [
  { id: "credit-accepted", amount: 15, label: "Accepted solution", createdAt: "2026-07-14T10:00:00.000Z" },
  { id: "credit-helpful", amount: 2, label: "Helpful answer vote", createdAt: "2026-07-15T07:30:00.000Z" },
  { id: "credit-reviewed", amount: 10, label: "Researcher-reviewed answer", createdAt: "2026-07-11T08:00:00.000Z" },
];

const storageKey = (user) => `agri_community_v${STORAGE_VERSION}_${user?.email?.toLowerCase() || "guest"}`;

export function createCommunityState() {
  return {
    questions: JSON.parse(JSON.stringify(seedQuestions)),
    credits: TEST_AGRI_POINT_BALANCE,
    testBalanceVersion: TEST_BALANCE_VERSION,
    creditLedger: JSON.parse(JSON.stringify(initialLedger)),
    votes: {},
    follows: [],
    meToo: [],
    vouchers: [],
  };
}

export function loadCommunityState(user) {
  try {
    const stored = localStorage.getItem(storageKey(user));
    if (stored) {
      const state = JSON.parse(stored);
      if (state.testBalanceVersion !== TEST_BALANCE_VERSION) {
        const migratedState = {
          ...state,
          credits: TEST_AGRI_POINT_BALANCE,
          testBalanceVersion: TEST_BALANCE_VERSION,
          vouchers: state.vouchers || [],
        };
        localStorage.setItem(storageKey(user), JSON.stringify(migratedState));
        return migratedState;
      }
      return { ...state, vouchers: state.vouchers || [] };
    }
  } catch {
    // Use the seeded prototype if browser storage is unavailable or corrupted.
  }
  return createCommunityState();
}

export function saveCommunityState(user, state) {
  try {
    localStorage.setItem(storageKey(user), JSON.stringify(state));
  } catch {
    // The page remains usable for the current session when storage is unavailable.
  }
}

export function createCommunityId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createVoucher(value) {
  return {
    id: createCommunityId("voucher"),
    value,
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function getCreditLevel(credits) {
  const levels = [
    { name: "Seedling", minimum: 0, next: 50 },
    { name: "Grower", minimum: 50, next: 200 },
    { name: "Helpful Contributor", minimum: 200, next: 500 },
    { name: "Trusted Contributor", minimum: 500, next: 1500 },
    { name: "Community Champion", minimum: 1500, next: null },
  ];
  return [...levels].reverse().find((level) => credits >= level.minimum) || levels[0];
}

export function getCreditProgress(credits) {
  const level = getCreditLevel(credits);
  if (!level.next) return { ...level, percent: 100, remaining: 0 };
  const earned = credits - level.minimum;
  const range = level.next - level.minimum;
  return {
    ...level,
    percent: Math.max(0, Math.min(100, Math.round((earned / range) * 100))),
    remaining: level.next - credits,
  };
}

export function relativeCommunityTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "Less than an hour ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export function matchesCommunitySearch(question, query) {
  const ignoredWords = new Set(["a", "an", "the", "on", "in", "after", "with", "my", "is", "are", "how", "do", "i", "this", "that", "can", "what"]);
  const terms = query.toLowerCase().trim().split(/\s+/).filter((term) => term && !ignoredWords.has(term));
  if (!terms.length) return true;
  const searchable = [question.title, question.crop, question.topic, question.location, question.body, question.symptoms]
    .join(" ")
    .toLowerCase();
  const matches = terms.filter((term) => searchable.includes(term)).length;
  return matches >= Math.min(2, terms.length);
}
