import { API_BASE_URL, ApiError } from "@/lib/api";
import { type AnalysisRequest, type StreamEvent, streamEventSchema } from "@/lib/schemas";

export interface StreamHandlers {
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

/** Parse a single SSE frame ("event: x\ndata: {...}") into a StreamEvent. */
export function parseSseFrame(frame: string): StreamEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("event:")) {
      eventName = trimmed.slice(6).trim();
    } else if (trimmed.startsWith("data:")) {
      dataLines.push(trimmed.slice(5).trim());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  try {
    const data: unknown = JSON.parse(dataLines.join("\n"));
    return streamEventSchema.parse({ event: eventName, data });
  } catch {
    return null;
  }
}

async function fetchStreamWithFallback(
  request: AnalysisRequest,
  signal?: AbortSignal,
): Promise<Response> {
  const primaryUrl = `${API_BASE_URL}/api/v1/analyze/stream`;
  try {
    const response = await fetch(primaryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(request),
      signal,
    });
    if (response.ok && response.body) {
      return response;
    }
    // If response returned 404 or 502, check fallback
    if (API_BASE_URL && API_BASE_URL.startsWith("http")) {
      try {
        const fbResponse = await fetch("/api/v1/analyze/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(request),
          signal,
        });
        if (fbResponse.ok && fbResponse.body) {
          return fbResponse;
        }
      } catch {
        // Fall back to primary response error below
      }
    }
    throw new ApiError(`Stream failed (HTTP ${response.status})`, response.status);
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    // Network error on primary cross-origin URL — try relative URL (Netlify proxy)
    if (API_BASE_URL && API_BASE_URL.startsWith("http")) {
      try {
        const fbResponse = await fetch("/api/v1/analyze/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(request),
          signal,
        });
        if (fbResponse.ok && fbResponse.body) {
          return fbResponse;
        }
      } catch {
        // Fall back to throwing original error
      }
    }
    throw error;
  }
}

/**
 * Stream a contract analysis via Server-Sent Events over a POST request.
 *
 * `EventSource` only supports GET, and our stream endpoint takes a JSON body,
 * so we POST and parse the SSE frames from the response body stream.
 */
export async function streamAnalysis(
  request: AnalysisRequest,
  { onEvent, signal }: StreamHandlers,
): Promise<void> {
  const response = await fetchStreamWithFallback(request, signal);
  if (!response.ok || !response.body) {
    throw new ApiError(`Stream failed (HTTP ${response.status})`, response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += value;
    let match = buffer.match(/\r?\n\r?\n/);
    while (match && match.index !== undefined) {
      const boundary = match.index;
      const delimiterLength = match[0].length;
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + delimiterLength);
      const event = parseSseFrame(frame);
      if (event) {
        onEvent(event);
      }
      match = buffer.match(/\r?\n\r?\n/);
    }
  }
}
