import { describe, expect, it } from "vitest";
import { GiftPageRequest, ManagePageRequest, givenProfileKeys } from "@/lib/api/schemas";
import { DEFAULT_PROFILE, routeGiftCheck } from "./helpers/situation";
import {
  answersToProfile,
  checkFor,
  homeLine,
  householdProfile,
  householdSituation,
  letterCheck,
  profileToAnswers,
  situationLine,
  storedProfile,
  type Answers,
} from "@/lib/situation";

/** Sam, from the sample letter: he lives in his mother's home, she gives him his meals, and he gets $600 of Social Security. */
const SAM: Answers = { home: "other", benefits: 600 };

describe("the plain questions map onto the rules engine's profile", () => {
  it("lives in her mother's home with $600 of Social Security: the household and the income, nothing else changed", () => {
    const { profile, given } = answersToProfile(SAM, "he");
    expect(profile).toEqual({ ...DEFAULT_PROFILE, pronoun: "he", livesInAnothersHousehold: true, otherUnearnedMonthly: 600 });
    expect(given.sort()).toEqual(["livesInAnothersHousehold", "otherUnearnedMonthly"]);
  });

  it("gives her own check, not the full one: $1,029 less $580 counted and the one-third reduction, $106 for January 2027", () => {
    const { profile } = answersToProfile(SAM, "he");
    const c = checkFor(profile, "2026-11");
    expect([c.check, c.paymentMonth, c.household?.rule]).toEqual([106, "2027-01", "vtr"]);
    expect(homeLine(profile, "2026-11")).toMatch(/already reduced by a third, \$343, gift or not/);
  });

  it("with no answers the sample situation stays: one adult on her own, no other income, the full check", () => {
    const { profile, given } = answersToProfile({});
    expect(given).toEqual([]);
    expect(profile).toEqual(DEFAULT_PROFILE);
    expect(checkFor(profile, "2026-11").check).toBe(1029);
  });

  it("her own place clears the questions about someone else's home; paying her share there ends the reduction", () => {
    expect(answersToProfile({ home: "own", householdSize: 3, householdPays: 400 }).profile).toEqual({ ...DEFAULT_PROFILE, livesInAnothersHousehold: false });
    // A home of three with $1,200 of costs: her share is $400, and she pays it, so the household does not lower her check.
    const sharing = answersToProfile({ home: "other", householdSize: 3, householdCosts: 1200, householdPays: 400 }).profile;
    expect(checkFor(sharing, "2026-11").check).toBe(1029);
    expect(homeLine(sharing, "2026-11")).toMatch(/pays her share of the home's costs, so living there does not lower her check/);
    // No meals from the household: the shelter counts at the presumed maximum value instead, $363 in 2027, less the $20 general exclusion.
    expect(checkFor(answersToProfile({ home: "other", meals: false }).profile, "2026-11").check).toBe(1029 - (363 - 20));
  });

  it("wages, a couple, savings and ABLE map to their fields, and amounts that are not dollars are left out", () => {
    const { profile, given } = answersToProfile({ wages: 465, couple: true, savings: 2500, ableEligible: false, benefits: -5 });
    expect(profile).toMatchObject({ earnedMonthly: 465, couple: true, savings: 2500, ableEligible: false, otherUnearnedMonthly: 0 });
    expect(given.sort()).toEqual(["ableEligible", "couple", "earnedMonthly", "savings"]);
  });

  it("the answers come back from a stored profile: only the ones given, or every field for the sample page", () => {
    const { profile, given } = answersToProfile({ ...SAM, meals: true, savings: 300 }, "he");
    expect(profileToAnswers(profile, given)).toEqual({ ...SAM, meals: true, savings: 300 });
    expect(profileToAnswers({ pronoun: "she", couple: false, livesInAnothersHousehold: false, otherUnearnedMonthly: 0, earnedMonthly: 0, ableEligible: true, savings: 1240 })).toEqual({
      home: "own",
      benefits: 0,
      wages: 0,
      couple: false,
      savings: 1240,
      ableEligible: true,
    });
  });
});

describe("a page stores its facts with where they came from, and the engine reads only its own fields", () => {
  it("the stored profile carries the source and the fields given; the engine's profile drops them", () => {
    const { profile, given } = answersToProfile(SAM, "he");
    const stored = storedProfile(profile, given, "letter", new Date("2026-11-10T12:00:00Z"));
    expect(householdSituation(stored)).toEqual({ source: "letter", saved_at: "2026-11-10T12:00:00.000Z", given });
    expect(householdProfile(stored)).toEqual(profile);
    expect("situation" in householdProfile(stored)).toBe(false);
    expect(householdProfile({ pronoun: "they", injected: 1 })).toEqual({ ...DEFAULT_PROFILE, pronoun: "they" });
    expect(householdSituation({ pronoun: "she" })).toBeNull();
  });

  it("the page's line names her own facts", () => {
    expect(situationLine(answersToProfile(SAM, "he").profile)).toBe("lives in someone else's home, $600 a month in Social Security or other benefits, $1,240 in savings");
    expect(situationLine(DEFAULT_PROFILE)).toBe("lives on her own, no other benefits, $1,240 in savings");
  });

  it("routing still keeps her own check whole: every need paid the benefit-safe way leaves $106", () => {
    expect(routeGiftCheck(answersToProfile(SAM, "he").profile)).toEqual({ withGiftwise: 106, baseline: 106, asCash: 0 });
  });
});

describe("the letter's payment is checked against the engine's check for the same month", () => {
  it("matches when the facts read give the payment the letter states", () => {
    const c = letterCheck(SAM, { amount: 106, month: "2027-01" }, "he");
    expect(c).toMatchObject({ matches: true, letterSays: 106, answersGive: 106, monthLabel: "January 2027" });
    expect(c.plain).toBe("Matches his letter: $106 for January 2027.");
  });

  it("says so, neutrally, when the answers give another amount, such as with a state supplement", () => {
    const c = letterCheck(SAM, { amount: 156, month: "2027-01" }, "she");
    expect(c).toMatchObject({ matches: false, letterSays: 156, answersGive: 106 });
    expect(c.plain).toBe("Her letter says $156 for January 2027; these answers give $106. Check the answers above.");
  });

  it("uses that month's rate: the same facts for a 2026 payment give $994 less the same counts", () => {
    expect(letterCheck(SAM, { amount: 82.67, month: "2026-12" }).answersGive).toBe(Math.round((994 - 580 - 331.33) * 100) / 100);
  });

  it("names what is missing when the letter states no month or no payment", () => {
    expect(letterCheck(SAM, { amount: 106, month: null })).toMatchObject({ matches: null, plain: "The letter does not name the month its payment is for, so there is nothing to compare." });
    expect(letterCheck(SAM, { amount: null, month: "2027-01" })).toMatchObject({ matches: null, plain: "The letter does not state a monthly payment, so there is nothing to compare." });
  });
});

describe("the API takes the same facts", () => {
  it("a new page and the manage link accept the profile, and only the fields sent count as given", () => {
    const body = { name: "Sam", pronoun: "he", needs: [{ title: "Wheelchair cushion", amount: 120, category: "equipment" }], profile: { livesInAnothersHousehold: true, otherUnearnedMonthly: 600 }, profile_source: "letter" };
    const parsed = GiftPageRequest.parse(body);
    expect(parsed.profile).toMatchObject({ livesInAnothersHousehold: true, otherUnearnedMonthly: 600, savings: 1240 });
    expect(givenProfileKeys(body).sort()).toEqual(["livesInAnothersHousehold", "otherUnearnedMonthly"]);
    expect(givenProfileKeys({ profile: { bogus: 1 } })).toEqual([]);
    expect(ManagePageRequest.parse({ profile: null }).profile).toBeNull();
    expect(ManagePageRequest.safeParse({ profile: { otherUnearnedMonthly: -1 } }).success).toBe(false);
  });
});
