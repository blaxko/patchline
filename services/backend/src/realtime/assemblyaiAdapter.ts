import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { env } from "../env.js";
import { mintAssemblyAIToken } from "./token.js";

// AssemblyAI Universal-Streaming v3 message shapes — verified per DECISIONS.md D1/D3/D9.
export interface AaiBeginMessage {
  type: "Begin";
  id: string;
  expires_at: number;
}

export interface AaiWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  word_is_final: boolean;
}

export interface AaiTurnMessage {
  type: "Turn";
  turn_order: number;
  turn_is_formatted: boolean;
  end_of_turn: boolean;
  transcript: string;
  end_of_turn_confidence: number;
  words: AaiWord[];
}

export interface AaiTerminationMessage {
  type: "Termination";
  audio_duration_seconds: number;
  session_duration_seconds: number;
}

export interface AaiHeartbeatMessage {
  type: "Heartbeat";
  total_audio_received_ms: number;
  total_duration_ms: number;
}

export interface ConfigForAdapter {
  speechModel: string;
  contextMode: string;
  prompt: string | null;
  keytermsPrompt: string | null; // JSON string[] or null
  formatTurns: boolean;
  endOfTurnConfidenceThreshold: number;
}

function buildQueryParams(config: ConfigForAdapter): URLSearchParams {
  const params = new URLSearchParams();
  params.set("speech_model", config.speechModel);
  params.set("sample_rate", "16000");
  params.set("encoding", "pcm_s16le");
  params.set("format_turns", String(config.formatTurns));
  params.set("end_of_turn_confidence_threshold", String(config.endOfTurnConfidenceThreshold));

  if (config.contextMode === "prompt" && config.prompt) {
    params.set("prompt", config.prompt);
  }
  if (config.contextMode === "keyterms" && config.keytermsPrompt) {
    const terms: string[] = JSON.parse(config.keytermsPrompt);
    for (const term of terms) {
      params.append("keyterms_prompt", term);
    }
  }

  return params;
}

/**
 * Wraps one AssemblyAI (or mocked) streaming WS connection and translates
 * Begin/Turn/Termination/Heartbeat frames into typed events. Ownership per
 * PRD.md §1: protocol details only, no entity/business semantics.
 */
export class AssemblyAIAdapter extends EventEmitter {
  private ws: WebSocket | null = null;

  async connect(config: ConfigForAdapter): Promise<void> {
    const params = buildQueryParams(config);
    let url: string;

    if (env.MOCK_ASSEMBLYAI) {
      // Read lazily (not from the frozen `env` object) so tests can point
      // different runs at different mock-server ports without re-importing.
      const mockUrl = process.env.MOCK_ASSEMBLYAI_WS_URL ?? env.MOCK_ASSEMBLYAI_WS_URL;
      url = `${mockUrl}/v3/ws?${params.toString()}`;
    } else {
      const token = await mintAssemblyAIToken(60);
      params.set("token", token);
      url = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.once("open", () => resolve());
      ws.once("error", (err) => reject(err));

      ws.on("message", (data, isBinary) => {
        if (isBinary) return;
        this.handleMessage(data.toString());
      });

      ws.on("close", (code, reason) => {
        this.emit("close", { code, reason: reason.toString() });
      });

      ws.on("error", (err) => {
        this.emit("error", err);
      });
    });
  }

  private handleMessage(raw: string): void {
    let msg: { type: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "Begin":
        this.emit("begin", msg as AaiBeginMessage);
        break;
      case "Turn":
        this.emit("turn", msg as AaiTurnMessage);
        break;
      case "Termination":
        this.emit("termination", msg as AaiTerminationMessage);
        break;
      case "Heartbeat":
        this.emit("heartbeat", msg as AaiHeartbeatMessage);
        break;
      default:
        break;
    }
  }

  sendAudio(chunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  terminate(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "Terminate" }));
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
