import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const productionHosts = new Set(["planarisrl.com", "www.planarisrl.com"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isProductionHost = productionHosts.has(host);
  const isHttp =
    request.nextUrl.protocol === "http:" || forwardedProto === "http";

  if (isProductionHost && isHttp) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
};
