import { useEffect, useRef } from "react";

/**
 * Real-time waveform visualizer using Web Audio API AnalyserNode.
 * Shows a bar chart of frequency data while recording.
 */
export default function VoiceWaveform({ analyserNode, active }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (!active || !analyserNode) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw flat idle line
      ctx.strokeStyle = "#2a2d3e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray    = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const alpha = 0.6 + (dataArray[i] / 255) * 0.4;
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserNode, active]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={60}
      className="voice-waveform"
    />
  );
}
