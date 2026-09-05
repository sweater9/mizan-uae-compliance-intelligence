export function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY),
  });
}
