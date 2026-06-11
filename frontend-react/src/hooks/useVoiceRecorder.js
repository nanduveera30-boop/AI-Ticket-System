import { useState, useRef, useCallback, useEffect } from "react";

function getSupportedMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

const SUPPORTED_MIME = getSupportedMime();

export function useVoiceRecorder() {
  const [state, setState]         = useState("idle"); // idle | recording | processing | done | error
  const [audioBlob, setBlob]      = useState(null);
  const [audioUrl, setUrl]        = useState(null);
  const [duration, setDuration]   = useState(0);
  const [error, setError]         = useState(null);
  const [analyserNode, setAnalyser] = useState(null);

  const mediaRef    = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const streamRef   = useRef(null);
  const audioCtxRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setBlob(null);
    setUrl(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Waveform analyser
      const ctx      = new AudioContext();
      audioCtxRef.current = ctx;
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyser(analyser);

      const recorder = new MediaRecorder(stream, {
        mimeType: SUPPORTED_MIME || undefined,
      });
      mediaRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: SUPPORTED_MIME || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setBlob(blob);
        setUrl(url);
        setState("done");
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
      };

      recorder.start(100); // collect every 100ms
      setState("recording");

      // Duration counter
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setError(err.message || "Microphone access denied");
      setState("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state === "recording") {
      mediaRef.current.stop();
    }
    clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const reset = useCallback(() => {
    stopRecording();
    setBlob(null);
    setUrl(null);
    setDuration(0);
    setError(null);
    setState("idle");
    setAnalyser(null);
  }, [stopRecording]);

  return {
    state, audioBlob, audioUrl, duration, error, analyserNode,
    startRecording, stopRecording, reset,
  };
}
