"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0A0A0A] text-[#F5F4F0] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full rounded-3xl border border-[#2A2A2A] bg-[#141414] p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-[#D4AF37]">Application Recovery</h2>
          <p className="text-sm text-[#A29E96]">
            An unexpected error occurred while loading Trio Dealers.
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}

