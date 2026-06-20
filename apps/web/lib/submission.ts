/**
 * Submission-readiness template (Demo / "FOMO Killer" submission checklist).
 *
 * Submission items are just regular checklist rows with `targetType:
 * "submission"` — there is NO separate table. The /demo page seeds these by
 * POSTing each entry to `/api/checklist`. This module only exports the constant;
 * it does not wire any UI or perform writes.
 */
export interface SubmissionTemplateItem {
  title: string;
  notes: string;
}

export const SUBMISSION_TEMPLATE: SubmissionTemplateItem[] = [
  {
    title: "Add your Devpost project link",
    notes: "Create your project on Devpost and paste the public submission URL.",
  },
  {
    title: "Record and upload your demo video",
    notes: "Keep it under the time limit and make sure the link is publicly viewable.",
  },
  {
    title: "Publish your public repo",
    notes: "Push your code to a public GitHub repo and confirm the link works.",
  },
  {
    title: "Submit before the deadline",
    notes: "Hit submit on Devpost before the hackathon submission deadline closes.",
  },
];
