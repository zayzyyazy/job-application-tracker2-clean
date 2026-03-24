/**
 * Next.js instrumentation — logs server-side failures that would otherwise surface as generic 500s.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[instrumentation][unhandledRejection]", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[instrumentation][uncaughtException]", err);
    });
  }
}
