import client from "./client";

/**
 * Transcribe audio blob — returns { transcript, extracted_fields }
 */
export const transcribeAudio = (blob, token) => {
  const form = new FormData();
  // Force plain webm MIME so backend validation passes regardless of codec variant
  const cleanBlob = new Blob([blob], { type: "audio/webm" });
  form.append("audio", cleanBlob, "recording.webm");
  return client
    .post("/voice/transcribe", form, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    })
    .then((r) => r.data);
};

export const processVoiceTicket = (blob, token) => {
  const form = new FormData();
  const cleanBlob = new Blob([blob], { type: "audio/webm" });
  form.append("audio", cleanBlob, "recording.webm");
  return client
    .post("/voice/process", form, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    })
    .then((r) => r.data);
};
