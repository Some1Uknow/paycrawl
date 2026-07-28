import {
  hasValidDemoOriginToken,
  unauthorizedOriginResponse,
} from "../../../../../../lib/demo-origin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  if (!hasValidDemoOriginToken(request.headers)) {
    return unauthorizedOriginResponse();
  }

  const { slug } = await params;
  const safeTitle =
    slug.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || "article";
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>PayCrawl demo article</title></head>
  <body>
    <article>
      <h1>PayCrawl demo: ${safeTitle}</h1>
      <p>This publisher-controlled article was delivered only after a valid Celo x402 payment was verified and settled.</p>
      <p>The corresponding gateway response contains the on-chain PAYMENT-RESPONSE receipt.</p>
    </article>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
