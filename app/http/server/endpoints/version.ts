import { resolveFromBase } from "@/helpers/paths";

export const getVersion = async () => {
  const version = await Bun.file(resolveFromBase("package.json")).json();
  return new Response(JSON.stringify({ version: version.version }));
};
