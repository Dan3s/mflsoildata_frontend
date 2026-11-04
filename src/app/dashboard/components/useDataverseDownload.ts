"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  dataverseService,
  type DataverseFileInfo,
  type DataversePreviewResponse,
  type DownloadedFile,
  type GuestbookInfo,
} from "@/app/services";

/**
 * Guestbook state + the one download call shared by the standalone Dataverse
 * browser and the upload wizard's Dataverse step — a dataset's Guestbook is
 * answered once and the answer applies to every file downloaded from it
 * afterwards, regardless of which UI triggered the download.
 */
export function useDataverseDownload(token?: string) {
  const { data: session } = useSession();

  const [guestbook, setGuestbook] = useState<GuestbookInfo | null>(null);
  const [guestbookLoading, setGuestbookLoading] = useState(false);
  const [guestbookName, setGuestbookName] = useState("");
  const [guestbookEmail, setGuestbookEmail] = useState("");
  const [guestbookInstitution, setGuestbookInstitution] = useState("");
  const [guestbookPosition, setGuestbookPosition] = useState("");
  const [guestbookAnswers, setGuestbookAnswers] = useState<Record<number, string>>({});
  const [guestbookConfirmed, setGuestbookConfirmed] = useState(false);

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /** Call once a fresh dataset preview comes back. Fetches the Guestbook's
   * questions when the dataset requires one, and resets any previous answers. */
  const loadForPreview = async (preview: DataversePreviewResponse) => {
    setGuestbook(null);
    setGuestbookConfirmed(false);
    setGuestbookAnswers({});
    setGuestbookInstitution("");
    setGuestbookPosition("");
    setGuestbookName(session?.user?.name || "");
    setGuestbookEmail(session?.user?.email || "");
    setDownloadError(null);
    if (preview.requires_guestbook && preview.guestbook_id) {
      setGuestbookLoading(true);
      try {
        const gb = await dataverseService.getGuestbook(preview.guestbook_id, token);
        setGuestbook(gb);
      } finally {
        setGuestbookLoading(false);
      }
    }
  };

  const guestbookMissing = (): string[] => {
    if (!guestbook) return [];
    const missing: string[] = [];
    if (guestbook.name_required && !guestbookName.trim()) missing.push("name");
    if (guestbook.email_required && !guestbookEmail.trim()) missing.push("email");
    if (guestbook.institution_required && !guestbookInstitution.trim()) missing.push("institution");
    if (guestbook.position_required && !guestbookPosition.trim()) missing.push("position");
    for (const q of guestbook.custom_questions) {
      if (q.required && !(guestbookAnswers[q.id] || "").trim()) missing.push(q.question);
    }
    return missing;
  };

  const confirmGuestbook = (): boolean => {
    if (guestbookMissing().length > 0) return false;
    setGuestbookConfirmed(true);
    return true;
  };

  /** True once a dataset is known to need a Guestbook but it hasn't been
   * answered yet — callers disable download/import actions while this holds. */
  const needsGuestbookForm = (preview: DataversePreviewResponse | null) =>
    Boolean(preview?.requires_guestbook) && guestbook !== null && !guestbookConfirmed;

  const downloadFile = async (file: DataverseFileInfo): Promise<DownloadedFile | null> => {
    setDownloadError(null);
    setDownloadingId(file.id);
    try {
      return await dataverseService.downloadFile({
        file_id: file.id,
        filename: file.filename,
        token,
        guestbook_response:
          guestbook && guestbookConfirmed
            ? {
                name: guestbookName || undefined,
                email: guestbookEmail || undefined,
                institution: guestbookInstitution || undefined,
                position: guestbookPosition || undefined,
                answers: Object.entries(guestbookAnswers)
                  .filter(([, value]) => value.trim())
                  .map(([id, value]) => ({ id: Number(id), value })),
              }
            : undefined,
      });
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
      return null;
    } finally {
      setDownloadingId(null);
    }
  };

  return {
    guestbook,
    guestbookLoading,
    guestbookName,
    setGuestbookName,
    guestbookEmail,
    setGuestbookEmail,
    guestbookInstitution,
    setGuestbookInstitution,
    guestbookPosition,
    setGuestbookPosition,
    guestbookAnswers,
    setGuestbookAnswers,
    guestbookConfirmed,
    guestbookMissing,
    confirmGuestbook,
    needsGuestbookForm,
    loadForPreview,
    downloadingId,
    downloadError,
    downloadFile,
  };
}

export type UseDataverseDownload = ReturnType<typeof useDataverseDownload>;
