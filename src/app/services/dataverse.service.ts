import { apiClient } from "./api-client";
import type {
  DataverseDownloadRequest,
  DataversePreviewResponse,
  GuestbookInfo,
} from "./api-types";

/** A file downloaded straight to the user's computer. */
export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

export const dataverseService = {
  /** Metadata + file list for a Dataverse dataset, to prefill the upload wizard
   * or to browse/download files directly. */
  preview: (doi: string, token?: string) =>
    apiClient.get<DataversePreviewResponse>("dataverse/preview", { doi, token }),

  /** A dataset's Guestbook: required-field flags + custom questions. */
  getGuestbook: (guestbookId: number, token?: string) =>
    apiClient.get<GuestbookInfo>(`dataverse/guestbook/${guestbookId}`, { token }),

  /**
   * Download a file straight to the user's computer — any signed-in user,
   * with optional Guestbook answers for a gated dataset. POST (not GET)
   * because the Guestbook response is a JSON body, not query params.
   */
  downloadFile: async (payload: DataverseDownloadRequest): Promise<DownloadedFile> => {
    const response = await fetch(apiClient.buildUrl("dataverse/file/download"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail || `Download failed with status ${response.status}`);
    }
    const disposition = response.headers.get("content-disposition") || "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : `dataverse_file_${payload.file_id}`;
    return { blob: await response.blob(), filename };
  },
};
