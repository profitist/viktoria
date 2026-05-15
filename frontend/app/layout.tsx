import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header className="flex gap-4 p-4 border-b">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>

            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>

          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
