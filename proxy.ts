import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (hostname === "owner.penstyle.space" && request.nextUrl.pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/owner";
    return NextResponse.rewrite(destination);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
