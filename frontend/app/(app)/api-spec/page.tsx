import Script from "next/script";
import { createElement } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
const openApiUrl = `${apiBaseUrl}/api/v1/openapi.json`;

export default function ApiSpecPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "white" }}>
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(5,5,5,0.92)",
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>Developer</div>
        <h1 style={{ margin: "4px 0 0", fontSize: "28px", fontWeight: 650 }}>API Documentation</h1>
      </div>

      <div style={{ minHeight: "calc(100vh - 89px)", background: "#ffffff" }}>
        {createElement("redoc", { "spec-url": openApiUrl })}
      </div>

      <Script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js" strategy="afterInteractive" />
    </div>
  );
}
