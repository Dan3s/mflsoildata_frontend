import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const getBackendBaseUrl = () => {
  const backendUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (!backendUrl) {
    throw new Error("Missing API URL. Set API_URL in src/.env.");
  }

  return backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`;
};

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  const targetUrl = new URL(params.path.join("/"), getBackendBaseUrl());
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  // Attach the signed-in user's Keycloak access token so the API can authenticate
  // and enforce roles. The token lives in the httpOnly session, never in the browser.
  const session = await auth();
  if (session?.accessToken) {
    headers.set("authorization", `Bearer ${session.accessToken}`);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);

  // Use arrayBuffer (not text) so binary payloads such as multipart .xlsx/.csv
  // uploads are forwarded byte-for-byte without corrupting the boundary/content.
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await context.params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await context.params);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await context.params);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await context.params);
}
