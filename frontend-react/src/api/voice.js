import client from "./client";

/**
 * Transcribe audio blob — returns { transcript, extracted_fields }
 * Note: token param kept for backward compat but interceptor handles auth.
 */
export const transcribeAudio = (blob, _token) => {
  const form = new FormData();
  // Normalize MIME — strip codec suffix (audio/webm;codecs=opus → audio/webm)
  const cleanBlob = new Blob([blob], { type: "audio/webm" });
  form.append("audio", cleanBlob, "recording.webm");
  return client
    .post("/voice/transcribe", form, {
      // Let browser set Content-Type with boundary automatically
      headers: { "Content-Type": undefined },
      // Never retry multipart — stream is consumed
      _noRetry: true,
    })
    .then((r) => r.data);
};

export const processVoiceTicket = (blob, _token) => {
  const form = new FormData();
  const cleanBlob = new Blob([blob], { type: "audio/webm" });
  form.append("audio", cleanBlob, "recording.webm");
  return client
    .post("/voice/process", form, {
      headers: { "Content-Type": undefined },
      _noRetry: true,
    })
    .then((r) => r.data);
};
