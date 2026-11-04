import { apiClient } from "./api-client";
import type { ChatResponse, ChatTurn } from "./api-types";

export const chatService = {
  /** Ask the Q&A assistant a question. The client resends the transcript each
   * turn — there is no server-side session state yet. */
  sendMessage: (message: string, history: ChatTurn[]) =>
    apiClient.post<ChatResponse>("chat/message", { message, history }),
};
