type EnvironmentVariablesOutput = {
  variables: string[];
};

/**
 * Scan a package directory for environment variables
 * @param mcpName Name of the package (e.g., "perplexity-search")
 * @returns Array of environment variables (eg. ["PERPLEXITY_API_KEY", "PERPLEXITY_API_SECRET"])
 */
export const scanEnvVars = async (
  mcpName: string
): Promise<EnvironmentVariablesOutput> => {
  try {
    // Get the package configuration
    const packageConfig = await getEnv(mcpName);
    if (!packageConfig) {
      throw new Error(`Package "${mcpName}" not found in configuration`);
    }

    const sourceDir = packageConfig.source as string;
    if (!sourceDir) {
      throw new Error(`Source directory not found for package "${mcpName}"`);
    }

    const envVars: Record<string, { description: string; required: boolean }> =
      {};

    // Check for smithery.yaml which might contain environment variable definitions
    try {
      const smitheryFile = Bun.file(`${sourceDir}/smithery.yaml`);
      if (await smitheryFile.exists()) {
        const smitheryContent = await smitheryFile.text();

        // Extract environment variables from smithery.yaml
        // This is a basic implementation and might need to be adjusted based on the actual structure
        const envMatch = smitheryContent.match(/env:\s*{\s*([\s\S]*?)\s*}/);
        if (envMatch && envMatch[1]) {
          const envSection = envMatch[1];
          const envEntries = envSection.match(/(\w+):\s*([^,\n]+)/g);

          if (envEntries) {
            for (const entry of envEntries) {
              const parts = entry.split(":").map((part) => part.trim());
              if (parts.length >= 2 && parts[0]) {
                const key = parts[0];
                envVars[key] = {
                  description: `Environment variable from smithery.yaml`,
                  required: true,
                };
              }
            }
          }
        }

        // Check for required properties in configSchema if available
        const schemaMatch = smitheryContent.match(/required:\s*\[([\s\S]*?)\]/);
        if (schemaMatch && schemaMatch[1]) {
          const requiredProps = schemaMatch[1].match(/['"](\w+)['"]/g);
          if (requiredProps) {
            for (const prop of requiredProps) {
              const propName = prop.replace(/['"]/g, "");
              if (propName) {
                // Look for property descriptions
                const propRegex = new RegExp(
                  `${propName}:\\s*{[\\s\\S]*?description:\\s*["']([^"']+)["']`,
                  "i"
                );
                const propMatch = propRegex.exec(smitheryContent);
                const description =
                  propMatch && propMatch[1]
                    ? propMatch[1]
                    : `Required property from smithery.yaml`;

                envVars[propName] = {
                  description,
                  required: true,
                };
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading smithery.yaml: ${error}`);
      // Continue with the rest of the processing
    }

    // Check for .env.example files which might contain environment variable templates
    try {
      const envExampleFile = Bun.file(`${sourceDir}/.env.example`);
      if (await envExampleFile.exists()) {
        const envContent = await envExampleFile.text();
        const envLines = envContent
          .split("\n")
          .filter(
            (line) => line.trim() && !line.startsWith("#") && line.includes("=")
          );

        for (const line of envLines) {
          const parts = line.split("=");
          if (parts.length >= 2 && parts[0]) {
            const key = parts[0].trim();
            const value = parts.slice(1).join("=");
            envVars[key] = {
              description: `From .env.example: ${value.trim()}`,
              required: !value.includes("optional"),
            };
          }
        }
      }
    } catch (error) {}

    // First try to scan the src directory if it exists
    const srcDir = `${sourceDir}/src`;
    let scannedSource = false;

    try {
      // Check if src directory exists
      await Bun.spawn(["stat", srcDir], { stdout: "ignore", stderr: "ignore" });

      const foundEnvVars = await scanSourceDirectory(srcDir);
      scannedSource = true;

      // Merge found environment variables with existing ones
      for (const [key, value] of Object.entries(foundEnvVars)) {
        if (!envVars[key]) {
          envVars[key] = value;
        }
      }
    } catch (error) {
      // src directory doesn't exist or can't be accessed
      // console.log(
      //   `Source directory ${srcDir} not found, will try main directory`
      // );
    }

    // If src directory wasn't found or had issues, try scanning the main package directory
    if (!scannedSource) {
      try {
        // console.log(`Scanning main directory: ${sourceDir}`);
        const foundEnvVars = await scanSourceDirectory(sourceDir);

        // Merge found environment variables with existing ones
        for (const [key, value] of Object.entries(foundEnvVars)) {
          if (!envVars[key]) {
            envVars[key] = value;
          }
        }
      } catch (error) {
        console.error(`Error scanning main directory ${sourceDir}: ${error}`);
      }
    }

    // Return just the array of variable names according to the new output format
    return {
      variables: Object.keys(envVars),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error scanning environment variables: ${errorMessage}`);
  }
};

/**
 * Recursively scan a directory for environment variable usage in source files
 * @param directory The directory to scan
 * @returns Object containing found environment variables
 */
async function scanSourceDirectory(
  directory: string
): Promise<Record<string, { description: string; required: boolean }>> {
  const foundEnvVars: Record<
    string,
    { description: string; required: boolean }
  > = {};

  try {
    // Use fs.readdir equivalent in Bun
    const process = Bun.spawn(
      [
        "find",
        directory,
        "-type",
        "f",
        "-o",
        "-type",
        "d",
        "-not",
        "-path",
        "*/\\.*",
      ],
      {
        stdout: "pipe",
        stderr: "ignore",
      }
    );
    const output = await new Response(process.stdout).text();

    if (!output.trim()) {
      return foundEnvVars;
    }

    const entries = output.split("\n").filter((entry) => entry.trim());

    for (const entry of entries) {
      if (!entry || entry === directory) continue;

      try {
        // Check if it's a directory using stat
        const statProcess = Bun.spawn(["stat", "-f", "%Sp", entry], {
          stdout: "pipe",
        });
        const statOutput = await new Response(statProcess.stdout).text();
        const isDir = statOutput.trim().startsWith("d");

        if (isDir) {
          // Skip common directories to ignore
          const dirName = entry.split("/").pop() || "";
          if (
            ![
              "node_modules",
              ".git",
              "dist",
              "build",
              ".cache",
              "public",
            ].includes(dirName)
          ) {
            // Recursively scan subdirectories
            const subDirVars = await scanSourceDirectory(entry);
            Object.assign(foundEnvVars, subDirVars);
          }
        } else {
          // It's a file - process files with extensions likely to contain env vars
          const fileExtension = entry.split(".").pop()?.toLowerCase();
          if (
            [
              "js",
              "jsx",
              "ts",
              "tsx",
              "vue",
              "svelte",
              "astro",
              "py",
              "rb",
              "php",
              "go",
              "java",
              "rs",
              "sh",
            ].includes(fileExtension || "")
          ) {
            const fileVars = await scanFileForEnvVars(entry);
            Object.assign(foundEnvVars, fileVars);
          }
        }
      } catch (error) {
        console.error(`Error processing entry ${entry}: ${error}`);
        // Continue with next entry
      }
    }

    return foundEnvVars;
  } catch (error) {
    console.error(`Error scanning directory ${directory}: ${error}`);
    return foundEnvVars;
  }
}

/**
 * Extract environment variable names from code
 */
function extractEnvVarsFromCode(code: string): string[] {
  const results: string[] = [];

  // Match patterns like process.env.VAR_NAME or process.env['VAR_NAME'] or process.env["VAR_NAME"]
  const regexPatterns = [
    // process.env.VAR_NAME
    /process\.env\.([A-Z0-9_]+)/g,
    // process.env['VAR_NAME'] or process.env["VAR_NAME"]
    /process\.env\[["']([A-Z0-9_]+)["']\]/g,
    // getEnv('VAR_NAME')
    /getEnv\(["']([A-Z0-9_]+)["']\)/g,
    // env('VAR_NAME') or environment('VAR_NAME')
    /(?:env|environment)\(["']([A-Z0-9_]+)["']\)/g,
    // required environment variables mentioned in comments
    /\brequires?\s+(?:env(?:ironment)?\s+)?(?:var(?:iable)?s?\s+)?["']?([A-Z0-9_]+)["']?/gi,
    // Constants assigned from process.env
    /const\s+\w+\s*=\s*process\.env(?:\.|\[["'])([A-Z0-9_]+)/g,
    // Checking if environment variables are set
    /if\s*\(\s*(?:!|not)?\s*process\.env(?:\.|\[["'])([A-Z0-9_]+)/g,
    // Destructuring from process.env
    /const\s*\{\s*([A-Z0-9_]+)\s*\}\s*=\s*process\.env/g,
    // env: { VAR_NAME: process.env.VAR_NAME }
    /\b([A-Z0-9_]+)\s*:\s*process\.env(?:\.|\[["'])(?:[A-Z0-9_]+)/g,
    // env: { VAR_NAME }
    /\b([A-Z0-9_]+)\s*\}\s*=\s*process\.env/g,
    // Pulling from .env files
    /^([A-Z0-9_]+)=/gm,
    // Check for API_KEY mentions in code
    /["']([A-Z0-9_]+_API_KEY)["']/g,
    /["']([A-Z0-9_]+_TOKEN)["']/g,
  ];

  for (const regex of regexPatterns) {
    let match;
    while ((match = regex.exec(code)) !== null) {
      const varName = match[1];
      if (varName && !results.includes(varName) && varName.length > 1) {
        results.push(varName);
      }
    }
  }

  return results;
}

/**
 * Scan a file for environment variable usage
 * @param filePath The path to the file
 * @returns Object containing found environment variables
 */
async function scanFileForEnvVars(
  filePath: string
): Promise<Record<string, { description: string; required: boolean }>> {
  const foundEnvVars: Record<
    string,
    { description: string; required: boolean }
  > = {};

  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const fileExtension = filePath.split(".").pop()?.toLowerCase();

    // Extract environment variables using the new function
    const extractedVars = extractEnvVarsFromCode(content);
    for (const varName of extractedVars) {
      if (!foundEnvVars[varName]) {
        foundEnvVars[varName] = {
          description: `Found in ${filePath.split("/").slice(-2).join("/")}`,
          required: true, // Assume required unless proven otherwise
        };
      }
    }

    // Different patterns for different file types
    const patterns: Array<{
      regex: RegExp;
      group: number;
      description: (match: string, filePath: string) => string;
    }> = [
      // JavaScript/TypeScript: process.env.VAR_NAME
      {
        regex: /process\.env\.([A-Z0-9_]+)/g,
        group: 1,
        description: (match, filePath) =>
          `Used as process.env.${match} in ${filePath}`,
      },
      // JavaScript/TypeScript: process.env["VAR_NAME"]
      {
        regex: /process\.env\[["']([A-Z0-9_]+)["']\]/g,
        group: 1,
        description: (match, filePath) =>
          `Used as process.env["${match}"] in ${filePath}`,
      },
      // Vite/modern frameworks: import.meta.env.VAR_NAME
      {
        regex: /import\.meta\.env\.([A-Z0-9_]+)/g,
        group: 1,
        description: (match, filePath) =>
          `Used as import.meta.env.${match} in ${filePath}`,
      },
      // Dotenv usage: dotenv.config() followed by process.env
      {
        regex: /process\.env\.([A-Z0-9_]+)/g,
        group: 1,
        description: (match, filePath) =>
          `Used as process.env.${match} in ${filePath}`,
      },
      // Environment variable in string interpolation
      {
        regex:
          /\$\{(?:process\.env\.|import\.meta\.env\.|env\.)([A-Z0-9_]+)\}/g,
        group: 1,
        description: (match, filePath) =>
          `Used in string interpolation in ${filePath}`,
      },
      // Direct env references (common in various languages)
      {
        regex: /env\[["']([A-Z0-9_]+)["']\]/g,
        group: 1,
        description: (match, filePath) =>
          `Used as env["${match}"] in ${filePath}`,
      },
      // Python os.environ.get
      {
        regex: /os\.environ\.get\(["']([A-Z0-9_]+)["']/g,
        group: 1,
        description: (match, filePath) =>
          `Used with os.environ.get in ${filePath}`,
      },
      // Docker ENV or ARG
      {
        regex: /(?:ENV|ARG)\s+([A-Z0-9_]+)=/g,
        group: 1,
        description: (match, filePath) =>
          `Defined as Docker ${
            filePath.includes("ENV") ? "ENV" : "ARG"
          } in ${filePath}`,
      },
    ];

    // Use the existing patterns for additional context/descriptions
    for (const pattern of patterns) {
      let match;
      // Need to reset the regex for each execution
      const regex = new RegExp(pattern.regex);

      while ((match = regex.exec(content)) !== null) {
        const envVar = match[pattern.group];

        // Skip if it's not a valid environment variable name
        if (!envVar || envVar.length === 0) continue;

        // If we're encountering this variable for the first time or updating with better description
        if (
          !foundEnvVars[envVar] ||
          foundEnvVars[envVar].description.startsWith("Found in")
        ) {
          foundEnvVars[envVar] = {
            description: pattern.description(
              envVar,
              filePath.split("/").slice(-2).join("/")
            ),
            required: true, // Assume required unless we find evidence otherwise
          };
        }
      }
    }

    // Look for comments that might describe environment variables
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip undefined lines
      if (!line) continue;

      // Look for comments that might describe environment variables
      const commentMatch = line.match(
        /\/\/\s*.*\b([A-Z0-9_]+)\b.*(?:env|environment)/i
      );
      if (commentMatch && commentMatch[1]) {
        const envVar = commentMatch[1];

        // Check if the next few lines use this environment variable
        let foundUsage = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine && nextLine.includes(envVar)) {
            foundUsage = true;
            break;
          }
        }

        if (
          foundUsage &&
          (!foundEnvVars[envVar] ||
            foundEnvVars[envVar].description.startsWith("Found in"))
        ) {
          // Extract the comment text
          const commentText = commentMatch[0].replace(/\/\/\s*/, "");
          foundEnvVars[envVar] = {
            description: `Comment: ${commentText} (in ${filePath
              .split("/")
              .slice(-2)
              .join("/")})`,
            required: commentText.toLowerCase().includes("required"),
          };
        }
      }
    }

    return foundEnvVars;
  } catch (error) {
    console.error(`Error scanning file ${filePath}: ${error}`);
    return foundEnvVars;
  }
}

export const getEnv = async (mcpName: string) => {
  const config = Bun.file(".furikake/configuration.json");
  const configJson = await config.json();

  return (
    configJson[mcpName] ||
    (configJson.installed && configJson.installed[mcpName])
  );
};
