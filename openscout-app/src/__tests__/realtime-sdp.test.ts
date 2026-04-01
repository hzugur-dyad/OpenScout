import { describe, expect, it } from "vitest";
import {
  extractRealtimeAnswerSdp,
  isLikelyRealtimeSessionSdp,
  normalizeRealtimeSdp,
} from "@/lib/mock-interview/realtime-sdp";

const rawSdp = [
  "v=0",
  "o=- 46117326 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0 1",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111 0 8",
  "a=ice-ufrag:test",
  "a=ice-pwd:testpwd",
  "a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00",
  "a=candidate:1 1 udp 2130706431 127.0.0.1 3478 typ host",
].join("\n");

describe("realtime-sdp", () => {
  it("normalizes raw SDP answers into CRLF format", () => {
    const normalized = extractRealtimeAnswerSdp(rawSdp);
    expect(normalized).toBe(normalizeRealtimeSdp(rawSdp));
    expect(isLikelyRealtimeSessionSdp(normalized)).toBe(true);
  });

  it("extracts SDP when the answer is wrapped in JSON", () => {
    const wrapped = JSON.stringify({
      answer: {
        sdp: rawSdp,
      },
    });

    const normalized = extractRealtimeAnswerSdp(wrapped);
    expect(normalized).toBe(normalizeRealtimeSdp(rawSdp));
    expect(isLikelyRealtimeSessionSdp(normalized)).toBe(true);
  });
});
