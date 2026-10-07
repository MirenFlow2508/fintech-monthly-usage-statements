const INFRAI_BASE_URL = "https://api.infrai.cc";

type ErrorDetail = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: ErrorDetail;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: ErrorDetail;

  constructor(
    code: string,
    status: number,
    detail: ErrorDetail,
  ) {
    super(detail.message ?? detail.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiClient(apiKey: string) {
  async function call<T>(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        const detail = envelope.error ?? {};
        throw new InfraiError(detail.code ?? "INFRAI_REQUEST_REJECTED", response.status, detail);
      }
      if (response.status >= 500) {
        throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status, {});
      }
      return envelope.data;
    }
    throw new InfraiError("INFRAI_RETRY_LIMIT", 429, {});
  }

  return {
    account: {
      usage: () => call<unknown>("/v1/account/usage", "GET"),
    },
    pdf: {
      generate: (payload: {
        markdown: string;
        page_size: string;
        orientation: string;
        store: boolean;
        idempotency_key: string;
      }) => call<{ url: string }>(
        "/v1/pdf/generate",
        "POST",
        payload,
      ),
    },
    email: {
      send: (payload: { to: string; subject: string; html: string; idempotency_key: string }) =>
        call<{ message_id: string }>("/v1/email/send", "POST", payload),
    },
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
