import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const getClient = () => {
  const apiKey =  process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key not found in environment. Please ensure GEMINI_API_KEY is set in .env.local.");
  return new GoogleGenAI({ apiKey });
};

// --- Research Tools Definition ---

const researchTools: FunctionDeclaration[] = [
  {
    name: "listFiles",
    description: "List files and directories in a specific path. Use '.' for root.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "The directory path (e.g. 'src/components' or '.')" }
      },
      required: ["path"]
    }
  },
  {
    name: "readFile",
    description: "Read the full content of a specific file. Use this to examine code.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "The file path to read" }
      },
      required: ["path"]
    }
  },
  {
    name: "searchCode",
    description: "Search for a specific code snippet, function name, or keyword across the repository.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "finishResearch",
    description: "Call this tool when you have gathered enough information to understand the issue and plan a fix. Do NOT call this if you haven't read the relevant code files yet.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    }
  }
];

export const getResearchStep = async (history: any[]) => {
  const ai = getClient();
  
  if (history.length === 0) {
    throw new Error("Research Agent history is empty. Initial system prompt is required.");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: history,
    config: {
      tools: [{ functionDeclarations: researchTools }],
    }
  });

  return response;
};

// --- Legacy/Planning Helpers ---

export const analyzeAndPlan = async (
  issueTitle: string, 
  issueBody: string, 
  fileContexts: { path: string, content: string }[]
): Promise<{ analysis: string, steps: string[] }> => {
  const ai = getClient();
  
  const contextStr = fileContexts.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n');
  
  const prompt = `
    You are a Senior Software Engineer.
    
    Issue: ${issueTitle}
    ${issueBody}
    
    Code Context:
    ${contextStr}
    
    Task:
    1. Analyze the bug/feature request. Briefly explain the root cause or requirement.
    2. Create a specific, step-by-step implementation plan to fix it.
    
    CRITICAL CONSTRAINTS:
    - FOCUS ONLY on the issue described. 
    - DO NOT plan for refactoring, code style improvements, or modernizing code unless explicitly requested in the issue.
    - Keep the scope minimal to resolve the issue.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });

  return JSON.parse(response.text || '{"analysis": "Failed to analyze", "steps": []}');
};

export const generateFileFix = async (
  issueBody: string, 
  plan: string, 
  filePath: string, 
  fileContent: string
): Promise<{ newContent: string, explanation: string }> => {
  const ai = getClient();
  
  const prompt = `
    You are a coding agent.
    
    Task: Implement the fix for the issue described below, strictly following the provided plan.
    Target File: ${filePath}
    
    Issue: ${issueBody}
    Plan: ${plan}
    
    Current File Content:
    \`\`\`
    ${fileContent}
    \`\`\`
    
    CONSTRAINTS:
    - Return the FULL new content of the file.
    - Do NOT remove existing comments or code unless they are part of the bug.
    - Do NOT change code style (indentation, quotes, etc.) unless necessary.
    - STRICTLY adhere to the plan. Do not "fix" other things you see in the file.
    
    Return the new content and a brief explanation of changes.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newContent: { type: Type.STRING },
          explanation: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text || '{"newContent": "", "explanation": "Failed"}');
};
