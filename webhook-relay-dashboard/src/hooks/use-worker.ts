// src/hooks/use-worker.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JsonToken } from '@/workers/json-parser.worker';
import JsonParserWorker from '@/workers/json-parser.worker?worker';

export function useJsonWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [tokens, setTokens] = useState<JsonToken[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
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

    workerRef.current.onerror = (err) => {
      console.error('Worker error:', err);
      setIsProcessing(false);
      setError('Worker failed to process payload');
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // ✅ FIX: Wrap in useCallback with empty dependencies. 
  // It only relies on workerRef.current, which is stable.
  const processJson = useCallback((rawJson: string) => {
    setIsProcessing(true);
    setTokens(null);
    setError(null);
    workerRef.current?.postMessage(rawJson);
  }, []);

  return { processJson, tokens, error, isProcessing };
}