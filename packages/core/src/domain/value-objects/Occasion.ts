/**
 * The occasion / context an outfit is intended for.
 */
export enum Occasion {
  Casual = 'casual',
  Business = 'business',
  Formal = 'formal',
  Sport = 'sport',
  Party = 'party',
  Date = 'date',
  Travel = 'travel',
  Home = 'home',
}

/**
 * A coarse "formality" score per occasion on a 0–10 scale. Used by the scoring
 * and matching services to reason about how dressed-up an outfit should be.
 * Higher means more formal.
 */
export const occasionFormality = (occasion: Occasion): number => {
  switch (occasion) {
    case Occasion.Formal:
      return 9;
    case Occasion.Business:
      return 7;
    case Occasion.Date:
      return 6;
    case Occasion.Party:
      return 6;
    case Occasion.Travel:
      return 3;
    case Occasion.Casual:
      return 3;
    case Occasion.Sport:
      return 1;
    case Occasion.Home:
      return 1;
    default:
      return 3;
  }
};

/** Occasions considered "formal enough" that a tie / tailoring is appropriate. */
export const isFormalOccasion = (occasion: Occasion): boolean =>
  occasionFormality(occasion) >= 7;

/** Occasions considered informal, where formal tailoring looks out of place. */
export const isInformalOccasion = (occasion: Occasion): boolean =>
  occasionFormality(occasion) <= 3;
