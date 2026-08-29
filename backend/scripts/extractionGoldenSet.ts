export interface GoldenCase {
  name: string;
  /** One message per turn; state carries forward via mergeExtraction between turns. */
  turns: string[];
  /** Case-insensitive substrings; at least one should appear in the final serviceCategory. */
  expectCategoryKeywords?: string[];
  /** This case has no clear single service category — a null category is acceptable. */
  expectCategoryNullable?: boolean;
  /** Case-insensitive substrings checked against category attribute name+description. Missing ones are a REVIEW, not a FAIL. */
  expectAttributeKeywords?: string[];
  /** Whether coreAttributes.dateTime should be non-null after all turns. */
  expectDateTimePresent?: boolean;
  /** Whether coreAttributes.location should be non-null after all turns. */
  expectLocationPresent?: boolean;
  /** Case-insensitive substring the final dateTime value should contain (for correction cases). */
  expectDateTimeContains?: string;
  note: string;
}

export const goldenSet: GoldenCase[] = [
  {
    name: "bounce house",
    turns: [
      "I need a bounce house for my son's 6th birthday party next Saturday at our house in Denver, CO.",
    ],
    expectCategoryKeywords: ["bounce house", "inflatable"],
    expectAttributeKeywords: ["water", "slide"],
    expectDateTimePresent: true,
    expectLocationPresent: true,
    note: "Baseline single-turn case with clear date and location stated up front.",
  },
  {
    name: "wedding photographer",
    turns: [
      "I'm getting married next June 12th and need a photographer to cover the ceremony and reception in Austin, Texas.",
    ],
    expectCategoryKeywords: ["photograph"],
    expectAttributeKeywords: ["hour", "package"],
    expectDateTimePresent: true,
    expectLocationPresent: true,
    note: "A completely different category from bounce house — attributes should look nothing alike.",
  },
  {
    name: "taco truck",
    turns: [
      "Help me find a taco truck for my company's summer picnic, about 80 people, in Chicago on August 9th.",
    ],
    expectCategoryKeywords: ["taco", "food truck"],
    expectAttributeKeywords: ["guest", "people", "menu"],
    expectDateTimePresent: true,
    expectLocationPresent: true,
    note: "Catering-adjacent category with a guest-count style attribute expected.",
  },
  {
    name: "bartender",
    turns: [
      "I need a bartender for a backyard engagement party, roughly 40 guests, in Portland, Oregon. We'll supply the alcohol ourselves.",
    ],
    expectCategoryKeywords: ["bartend"],
    expectAttributeKeywords: ["guest", "licens"],
    expectLocationPresent: true,
    note: "No date mentioned on purpose — dateTime should stay unset (no expectation set for it here).",
  },
  {
    name: "face painter",
    turns: ["Find a face painter for 20 kids at a birthday party this Sunday."],
    expectCategoryKeywords: ["face paint"],
    expectAttributeKeywords: ["kid", "children"],
    expectDateTimePresent: true,
    expectLocationPresent: false,
    note: "No location mentioned — location should stay unset rather than being guessed.",
  },
  {
    name: "ambiguous general request",
    turns: ["I'm planning a party and need some help figuring out what I need."],
    expectCategoryNullable: true,
    note: "Deliberately vague. A null category or a very generic one are both acceptable — eyeball the actual output.",
  },
  {
    name: "multi-requirement single message",
    turns: [
      "I need a bounce house and a face painter for my daughter's 8th birthday on August 30th in Miami, budget around $600 total.",
    ],
    expectCategoryKeywords: ["bounce house", "face paint", "party"],
    expectDateTimePresent: true,
    expectLocationPresent: true,
    note: "The schema only supports one serviceCategory — worth eyeballing how the LLM collapses two requested services into one category.",
  },
  {
    name: "multi-turn date correction",
    turns: [
      "I need a photographer for a baby shower on July 5th.",
      "Actually, change the date to July 12th instead.",
    ],
    expectCategoryKeywords: ["photograph"],
    expectDateTimePresent: true,
    expectDateTimeContains: "12",
    note: "Exercises the real merge policy end-to-end: the second turn's non-null date should overwrite the first.",
  },
  {
    name: "missing information",
    turns: ["I need a bartender."],
    expectCategoryKeywords: ["bartend"],
    expectDateTimePresent: false,
    expectLocationPresent: false,
    note: "Nothing else was stated. Any non-null date/location here would be a hallucination.",
  },
];
