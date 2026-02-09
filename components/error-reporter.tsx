"use client";

import { useEffect } from "react";

export function ErrorReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const post = (payload: unknown) => {
      try {
        window.parent?.postMessage(
          {
            source: "APP_RUNTIME_ERROR",
            ...payload,
          },
          "*"
        );
      } catch {
        // ignore
      }
    };

    const onError = (event: ErrorEvent) => {
      post({
        type: "runtime-error",
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; stack?: string } | string;

      post({
        type: "unhandled-rejection",
        message: typeof reason === "string" ? reason : reason?.message ?? "Unknown error",
        stack: typeof reason === "string" ? undefined : reason?.stack,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
