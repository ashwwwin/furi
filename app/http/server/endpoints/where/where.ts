import { getBasePath } from "@/helpers/paths";

export const whereResponse = async () => {
  const basePath = await getBasePath();

  return new Response(
    JSON.stringify({
      success: true,
      where: basePath,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};
