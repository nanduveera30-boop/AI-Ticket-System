"""Quick test of the voice pipeline."""
import sys, io, wave
sys.path.insert(0, '.')

from app.services.voice import _decode_with_pyav, get_whisper_model

# Generate 1-second silent WAV
buf = io.BytesIO()
with wave.open(buf, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(16000)
    w.writeframes(b'\x00' * 32000)

wav_bytes = buf.getvalue()
audio = _decode_with_pyav(wav_bytes, 'wav')
print(f'Decoded shape: {audio.shape}, dtype: {audio.dtype}')
print('PyAV decode: OK')

model = get_whisper_model()
result = model.transcribe(audio, language='en', fp16=False)
print(f'Whisper result: {repr(result["text"])}')
print('Full pipeline: OK')
