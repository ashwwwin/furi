import { getHttpServerStatusData } from "@/http/status/actions/getHttpStatus";

export const httpStatusResponse = async (
  url?: URL,
  lines?: number
): Promise<Response> => {
  const linesNumber = lines
    ? lines
    : parseInt(url?.searchParams.get("lines") || "15", 10);

  try {
    const data = await getHttpServerStatusData(linesNumber);
    return new Response(JSON.stringify({ success: true, data: data }));
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.toString() || "Unknown error",
      })
    );
  }
};
