// src/hooks/use-worker.ts
import { useEffect, useRef, useState } from 'react';

// ✅ FIX 1: Import the TYPE directly from the source file (NO ?worker suffix)
import type { JsonToken } from '@/workers/json-parser.worker';

// ✅ FIX 2: Import the WORKER CONSTRUCTOR using Vite's ?worker suffix
import JsonParserWorker from '@/workers/json-parser.worker?worker';

export function useJsonWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [tokens, setTokens] = useState<JsonToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // ✅ FIX 3: Instantiate using the imported constructor (Cleaner & fully typed)
    workerRef.current = new JsonParserWorker();

    workerRef.current.onmessage = (e: MessageEvent) => {
      setIsProcessing(false);
      if (e.data.success) {
        setTokens(e.data.tokens);
        setError(null);
      } else {
        setError(e.data.error);
      }
    };

    // EXPLICIT CLEANUP: Prevent memory leaks / detached workers
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const processJson = (rawJson: string) => {
    setIsProcessing(true);
    setTokens(null);
    setError(null);
    workerRef.current?.postMessage(rawJson);
  };

  return { processJson, tokens, error, isProcessing };
}