import client from "./client";

/**
 * Transcribe audio blob — returns { transcript, extracted_fields }
 */
export const transcribeAudio = (blob, token) => {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  return client
    .post("/voice/transcribe", form, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    })
    .then((r) => r.data);
};

/**
 * Process audio blob — returns full ProcessTicketResponse
 */
export const processVoiceTicket = (blob, token) => {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  return client
    .post("/voice/process", form, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    })
    .then((r) => r.data);
};
