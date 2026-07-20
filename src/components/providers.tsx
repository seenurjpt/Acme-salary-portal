"use client";

import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "./currency";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyProvider>{children}</CurrencyProvider>
    </SessionProvider>
  );
}
