// src/workers/json-parser.worker.ts
// This runs on a separate thread. It has NO access to the DOM or Window.

export interface JsonToken {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'brace' | 'text';
  value: string;
}

// A lightweight tokenizer to avoid returning massive HTML strings (XSS risk)
// and to allow the main thread to render React elements efficiently.
function tokenizeJson(jsonString: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  // Regex to match JSON structural elements
  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],]|[^":\s]+)/g;
  
  let match;
  while ((match = regex.exec(jsonString)) !== null) {
    let type: JsonToken['type'] = 'text';
    const value = match[0];

    if (/^"/.test(value)) {
      type = /:$/.test(value) ? 'key' : 'string';
    } else if (/^(true|false)$/.test(value)) {
      type = 'boolean';
    } else if (/^null$/.test(value)) {
      type = 'null';
    } else if (/^-?\d/.test(value)) {
      type = 'number';
    } else if (/^[{}[\]]$/.test(value)) {
      type = 'brace';
    }

    tokens.push({ type, value });
  }
  return tokens;
}

self.onmessage = (e: MessageEvent<string>) => {
  try {
    // 1. Parse the raw string (Heavy CPU task offloaded from main thread)
    const parsed = JSON.parse(e.data);
    // 2. Stringify with indentation for readability
    const formatted = JSON.stringify(parsed, null, 2);
    // 3. Tokenize for safe, React-friendly rendering
    const tokens = tokenizeJson(formatted);
    
    self.postMessage({ success: true, tokens });
  } catch (error) {
    self.postMessage({ success: false, error: (error as Error).message });
  }
};