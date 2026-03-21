import { describe, expect, it } from "vitest";
import {
  computeHiringScore,
  hiringFitTagFromScore,
  hiringScoreInputsFromInterviewRow,
  type HiringScoreInputs,
} from "@/lib/hiring-score";

describe("hiring-score", () => {
  it("computes normal weighted score (all dimensions)", () => {
    const inputs: HiringScoreInputs = {
      overall_score: 80,
      technical_score: 90,
      communication_score: 70,
      problem_solving_score: 60,
    };
    const wSum = 0.35 + 0.25 + 0.15 + 0.1;
    const blended =
      80 * (0.35 / wSum) +
      90 * (0.25 / wSum) +
      70 * (0.15 / wSum) +
      60 * (0.1 / wSum);
    expect(computeHiringScore(inputs)).toBe(Math.round(blended));
  });

  it("renormalizes weights when dimensions are missing", () => {
    const inputs: HiringScoreInputs = {
      overall_score: 100,
      technical_score: null,
      communication_score: 50,
      problem_solving_score: null,
    };
    const wSum = 0.35 + 0.15;
    const expected = Math.round(100 * (0.35 / wSum) + 50 * (0.15 / wSum));
    expect(computeHiringScore(inputs)).toBe(expected);
  });

  it("returns 0 when no numeric dimensions", () => {
    expect(
      computeHiringScore({
        overall_score: null,
        technical_score: null,
        communication_score: null,
        problem_solving_score: null,
      })
    ).toBe(0);
  });

  it("clamps inputs outside 0–100 before blending", () => {
    const wSum = 0.35 + 0.25;
    expect(
      computeHiringScore({
        overall_score: 150,
        technical_score: -10,
        communication_score: null,
        problem_solving_score: null,
      })
    ).toBe(Math.round(100 * (0.35 / wSum) + 0 * (0.25 / wSum)));
  });

  it("maps hiring fit tags by score thresholds", () => {
    expect(hiringFitTagFromScore(90)).toBe("Strong Fit");
    expect(hiringFitTagFromScore(75)).toBe("Good Fit");
    expect(hiringFitTagFromScore(60)).toBe("Average");
    expect(hiringFitTagFromScore(59)).toBe("Weak Fit");
  });

  it("hiringScoreInputsFromInterviewRow reads report sub-scores", () => {
    expect(
      hiringScoreInputsFromInterviewRow({
        interview_score: 72,
        interview_report: {
          technical_score: 80,
          communication_score: 65,
          problem_solving_score: 70,
        },
      })
    ).toEqual({
      overall_score: 72,
      technical_score: 80,
      communication_score: 65,
      problem_solving_score: 70,
      cv_score: null,
    });
  });
});
