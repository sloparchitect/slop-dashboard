// Helpers for extracting the opening-seconds "hook" out of a raw Whisper
// segments_json blob. Kept as pure functions so the hooks table can
// re-derive hook text client-side when the user toggles the window size,
// without a server round-trip.

interface RawSegment {
  from: string;
  to: string;
  text: string;
}

// Parse "HH:MM:SS,mmm" → seconds. Whisper writes timestamps with a comma
// decimal separator, not a period — `Number("00:00:01,500")` would NaN.
export function parseWhisperTimestamp(ts: string): number {
  const [hms, ms = "0"] = ts.split(",");
  const [h = "0", m = "0", s = "0"] = (hms ?? "").split(":");
  return (
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
  );
}

// Return the concatenated text of every segment that *starts* within the
// first `seconds` of the video. Empty string if the JSON is malformed or
// no segments qualify.
export function extractHook(segmentsJson: string, seconds: number): string {
  let segments: RawSegment[];
  try {
    segments = JSON.parse(segmentsJson) as RawSegment[];
  } catch {
    return "";
  }
  const out: string[] = [];
  for (const seg of segments) {
    const start = parseWhisperTimestamp(seg.from);
    if (start > seconds) break;
    if (seg.text) out.push(seg.text);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
