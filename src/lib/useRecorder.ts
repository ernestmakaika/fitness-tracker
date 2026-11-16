import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_AUDIO_BYTES } from "./gemini";

export type RecorderStatus = "idle" | "requesting" | "recording";

/** Recordings stop by themselves after this long. */
const MAX_MS = 120_000;

/**
 * Record a short clip from the microphone. `start` asks for the mic and begins;
 * `stop` ends it and hands the audio to `onAudio`; `cancel` throws it away.
 * Problems arrive through `onError`, worded for the user.
 */
export function useRecorder({ onAudio, onError }: { onAudio: (audio: Blob) => void; onError: (message: string) => void }) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const session = useRef<{ active: boolean; stream: MediaStream | null; recorder: MediaRecorder | null; timer?: ReturnType<typeof setTimeout> }>({
    active: true,
    stream: null,
    recorder: null,
  });
  // The latest callbacks, so a recording started earlier still reports to the current screen.
  const handlers = useRef({ onAudio, onError });
  handlers.current = { onAudio, onError };

  const release = useCallback(() => {
    const s = session.current;
    clearTimeout(s.timer);
    s.stream?.getTracks().forEach((track) => track.stop());
    s.stream = null;
    s.recorder = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = session.current.recorder;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    const recorder = session.current.recorder;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    release();
    if (session.current.active) setStatus("idle");
  }, [release]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      handlers.current.onError("This browser can’t record. Fill the form in by hand instead.");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const s = session.current;
      if (!s.active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      s.stream = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      s.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        release();
        if (!session.current.active) return;
        setStatus("idle");
        const audio = new Blob(chunks, { type: recorder.mimeType });
        if (!audio.size || audio.size > MAX_AUDIO_BYTES) handlers.current.onError("The recording is empty or too long. Try a shorter one.");
        else handlers.current.onAudio(audio);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        release();
        if (!session.current.active) return;
        setStatus("idle");
        handlers.current.onError("Recording failed. Try again, or fill the form in by hand.");
      };
      recorder.start();
      setStatus("recording");
      s.timer = setTimeout(stop, MAX_MS);
    } catch (cause) {
      release();
      if (!session.current.active) return;
      setStatus("idle");
      handlers.current.onError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone is off. Allow it in your browser settings to fill this in by voice."
          : "Couldn’t start recording. Try again, or fill the form in by hand.",
      );
    }
  }, [release, stop]);

  // Leaving the screen ends any recording and lets go of the microphone.
  useEffect(() => {
    const s = session.current;
    s.active = true;
    return () => {
      s.active = false;
      const recorder = s.recorder;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      clearTimeout(s.timer);
      s.stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { status, start, stop, cancel };
}
