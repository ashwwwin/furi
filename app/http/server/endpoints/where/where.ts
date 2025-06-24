import { getBasePath, getUserDataPath } from "@/helpers/paths";

export const whereResponse = async () => {
  const basePath = await getBasePath();
  const userDataPath = await getUserDataPath();
  return new Response(
    JSON.stringify({
      success: true,
      basePath: basePath,
      userPath: userDataPath,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};
