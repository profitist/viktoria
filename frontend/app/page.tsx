"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";

import { apiRequest } from "@/lib/api";

export default function HomePage() {
  const { getToken } = useAuth();

  async function testBackend() {
    const token = await getToken();

    const data = await apiRequest(
      "/protected",
      token || undefined
    );

    console.log(data);

    alert(JSON.stringify(data, null, 2));
  }

  return (
    <main className="p-10 flex flex-col gap-6">
      <header className="flex gap-4">
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>

        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>

      <button
        onClick={testBackend}
        className="border px-4 py-2 rounded"
      >
        Test Backend
      </button>
    </main>
  );
}
