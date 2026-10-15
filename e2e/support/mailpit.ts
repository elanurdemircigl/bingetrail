// Reads auth emails from the local Supabase mail catcher (Mailpit).
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

type MessageSummary = { ID: string };
type MessageDetail = { HTML: string };

/**
 * Waits for the newest `type` email sent to `email` and returns the path +
 * query of its /auth/confirm link, so the test can open it on its own host.
 */
export async function getAuthLinkPath(
  email: string,
  type: 'email' | 'recovery',
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const query = encodeURIComponent(`to:"${email}"`);

  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=20`);
    if (response.ok) {
      const { messages } = (await response.json()) as { messages: MessageSummary[] };
      for (const message of messages) {
        const detail = (await (
          await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)
        ).json()) as MessageDetail;
        const href = /href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(detail.HTML)?.[1];
        if (!href) continue;
        const url = new URL(href.replaceAll('&amp;', '&'));
        if (url.searchParams.get('type') === type) return `${url.pathname}${url.search}`;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No "${type}" email arrived for ${email} within ${timeoutMs} ms`);
}
