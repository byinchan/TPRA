export type Answer = "Yes" | "No" | "Unknown";
export type Level = "Low" | "Medium" | "High";
export type IraArea = "Data" | "System Access" | "Service Criticality" | "Technology" | "Regulatory";
export type DdqRating = "Satisfactory" | "Gap" | "Needs evidence";
export type ControlStrength = "Strong" | "Adequate" | "Weak";
export type Decision = "Approve" | "Approve with conditions" | "Escalate - do not approve yet";

export const ANSWERS: readonly Answer[] = ["Yes", "No", "Unknown"];
export const LEVELS: readonly Level[] = ["Low", "Medium", "High"];
export const DDQ_RATINGS: readonly DdqRating[] = ["Satisfactory", "Gap", "Needs evidence"];

export interface IraAnswer {
  id: string;
  answer: Answer;
}

export interface RatedIraAnswer extends IraAnswer {
  rating: Level;
}
