import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SRResultList { length: number; [i: number]: SRResult }
interface SREvent extends Event { resultIndex: number; results: SRResultList }
interface SRErrorEvent extends Event { error: string }
interface SR extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SRCtor = new () => SR;

function getCtor(): SRCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type SpeechStatus = "idle" | "listening" | "unsupported" | "denied" | "error";

export function useSpeech() {
  const [supported] = useState(() => typeof window !== "undefined" && !!getCtor());
  const [status, setStatus] = useState<SpeechStatus>(supported ? "idle" : "unsupported");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const recRef = useRef<SR | null>(null);
  const finalRef = useRef("");
  const onDoneRef = useRef<((text: string) => void) | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(
    (onDone: (text: string) => void) => {
      const Ctor = getCtor();
      if (!Ctor) {
        setStatus("unsupported");
        return;
      }
      finalRef.current = "";
      setFinalText("");
      setInterim("");
      onDoneRef.current = onDone;

      const rec = new Ctor();
      rec.lang = navigator.language || "en-US";
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => setStatus("listening");
      rec.onresult = (e) => {
        let interimStr = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += r[0].transcript;
          else interimStr += r[0].transcript;
        }
        setFinalText(finalRef.current);
        setInterim(interimStr);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setStatus("denied");
        else if (e.error === "no-speech" || e.error === "aborted") setStatus("idle");
        else setStatus("error");
      };
      rec.onend = () => {
        setStatus((s) => (s === "listening" ? "idle" : s));
        const text = (finalRef.current || "").trim();
        onDoneRef.current?.(text);
        recRef.current = null;
      };
      recRef.current = rec;
      try {
        rec.start();
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, status, interim, finalText, start, stop };
}
