export const jsonifyResponse = async (endpoint: () => Promise<Response>) => {
  const response = await endpoint();

  try {
    const text = await (await response.blob()).text();
    const parsed = JSON.parse(text);
    console.log(JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Invalid JSON response",
    };
  }
};
