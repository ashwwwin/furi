// TODO: Implement query endpoint
// Get active MCPs by text

import { GoogleGenAI } from "@google/genai";
import { toolsResponse } from "../tools";

export const queryEndpoint = async (query: string) => {
  const toolsList = await (await toolsResponse()).json();

  if (!toolsList || !Array.isArray(toolsList)) {
    return {
      error: "No tools found",
    };
  }

  const prompt = `
You help the user (who is a computer that accepts an array of tool names).

The user will input a query which is what they want to accomplish, your job is to give the user all the tool names they need.

You will find the right tool for their needs based on their query.

Think step by step and reason about the query and what tools might be relevant for the user.

Think step by step about what tools the user will need to do the task.

Consider any edge cases and what tools might be relevant for the user.

Be sure to consider all descriptions deeply.

The list of tools will contain the following fields:
          Name: name of the tool
                  Description: what the tool does

Here is the Tool List:
${toolsList
  .map((tool: any) => {
    return `
          Name: ${tool.name}
                  Description: ${tool.description}
`;
  })
  .join("\n")}

You must return a list of the most relevant tool names that match the query

Output Format:
["browser@open", "mac@save", "maps@navigate"]

Strictly follow the output format.

Only return an array of tool names from the Tools List. Do not return any other text.

Example:
User: "send an email to jared@getmcp.com to buy me a new macbook and research the best macbooks"
Assistant: ["email@send", "perplexity@research"]

Do NOT return any other text like ${"```json"} or ${"```"} or "Raw response text:". 

Strictly only return an array of tool names in the order of relevance.

STRICTLY only return in the format of ["tool1", "tool2", "tool3"].`;

  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Create content for the request
  const messages = [
    {
      role: "user",
      parts: [{ text: query }],
    },
  ];

  // Generate a text completion
  const result = await genai.models.generateContent({
    model: "gemini-2.5-flash-preview-04-17",
    contents: messages,
    config: {
      temperature: 1.0,
      maxOutputTokens: 64000,
      systemInstruction: {
        parts: [{ text: prompt }],
      },
    },
  });

  try {
    const responseText = result.text;
    if (typeof responseText !== "string") {
      console.error("LLM response text is not a string:", responseText);
      return { error: "Invalid LLM response format" };
    }

    // Assuming result.text is a string like '["tool1", "tool2"]'
    const toolNames = JSON.parse(responseText);

    if (!Array.isArray(toolNames)) {
      console.error("LLM did not return a valid array:", responseText);
      return { error: "Failed to parse tool list from LLM response" };
    }

    // Create a map for faster lookup
    const toolMap = new Map();
    toolsList.forEach((tool: any) => {
      toolMap.set(`${tool.name}`, tool);
    });

    // console.log(toolMap);

    // Enrich the tool names with details
    const enrichedTools = toolNames
      .map((name: string) => {
        const toolDetails = toolMap.get(name);
        if (toolDetails) {
          return {
            name: `${toolDetails.name}`,
            description: toolDetails.description,
            inputSchema: toolDetails.inputSchema, // Assuming input_schema exists
          };
        }
        console.warn(`Tool details not found for: ${name}`);
        return null; // Or handle missing tools differently
      })
      .filter((tool: any) => tool !== null); // Filter out nulls if any tool wasn't found

    console.log(enrichedTools); // Log the final result for now
    return enrichedTools;
  } catch (error) {
    console.error("Error processing LLM response:", error);
    if (result.text) {
      // Log raw text only if it exists
      console.error("Raw response text:", result.text);
    }
    // Type assertion for error message access
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: "Failed to process LLM response", details: errorMessage };
  }
};

queryEndpoint("Research the best macbooks and compile it into a PDF");
