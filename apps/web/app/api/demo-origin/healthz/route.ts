import {
  hasValidDemoOriginToken,
  unauthorizedOriginResponse,
} from "../../../../lib/demo-origin";

export const runtime = "nodejs";

function health(request: Request): Response {
  if (!hasValidDemoOriginToken(request.headers)) {
    return unauthorizedOriginResponse();
  }

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export const HEAD = health;
export const GET = health;
