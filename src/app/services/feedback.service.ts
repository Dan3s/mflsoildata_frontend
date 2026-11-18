import { apiClient } from "./api-client";
import type { FeedbackRequest, FeedbackResponse } from "./api-types";

export const feedbackService = {
  /** Email a piece of feedback to the team. Works signed in or not. */
  send: (payload: FeedbackRequest) => apiClient.post<FeedbackResponse, FeedbackRequest>("feedback", payload),
};
