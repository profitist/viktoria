"use client";

import { api } from "@/lib/api";

export default function HomePage() {
  async function testBackend() {
    const data = await api.get<unknown>("/protected");
    console.log(data);
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <main className="p-10 flex flex-col gap-6">
      <button onClick={testBackend} className="border px-4 py-2 rounded">
        Test Backend
      </button>
    </main>
  );
}
