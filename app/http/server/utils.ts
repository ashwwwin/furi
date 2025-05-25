export const extractMcpName = (
  url: string,
  page: string
): string | Response => {
  const pathParts = url.split("/").filter(Boolean);

  // Handle /add/<author>/<repo>
  if (pathParts[0] === "add" && pathParts.length === 3) {
    const author = pathParts[1];
    const repo = pathParts[2];
    if (author && repo) {
      return `${author}/${repo}`;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid repo details in add route",
        })
      );
    }
  }

  // Handle /<mcpName>/call/<toolName> or /<author>/<repo>/call/<toolName>
  if (page === "call") {
    const callIndex = pathParts.indexOf("call");
    if (callIndex === -1) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Could not find 'call' segment in path "${url}"`,
        })
      );
    }
    if (callIndex === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Could not resolve mcp name for page "${page}" from path "${url}"`,
        })
      );
    }
    // Join the parts before 'call' to form the mcpName
    const mcpNameStr = pathParts.slice(0, callIndex).join("/");
    return mcpNameStr;
  }

  // Handle original cases like /<mcpName>/remove or /<author>/<repo>/remove
  if (pathParts.length < 2 || pathParts[pathParts.length - 1] !== page) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Could not resolve mcp name for page "${page}" from path "${url}"`,
      })
    );
  }

  let mcpNameStr = pathParts[0];
  if (pathParts.length === 3 && pathParts[2] === page) {
    // <author>/<repo>/<page>
    mcpNameStr = pathParts[0] + "/" + pathParts[1];
  } else if (pathParts.length === 2 && pathParts[1] === page) {
    // <mcpName>/<page>
    mcpNameStr = pathParts[0];
  } else {
    // Only apply this check if it's not one of the handled <mcpName>/<page> or <author>/<repo>/<page> formats
    if (pathParts.length < 2 || pathParts[pathParts.length - 1] !== page) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Unexpected path structure for page "${page}": "${url}"`,
        })
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        message: `Unexpected path structure for page "${page}": "${url}"`,
      })
    );
  }

  return `${mcpNameStr}`;
};
