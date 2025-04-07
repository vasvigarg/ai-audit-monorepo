// File: apps/api/src/app/api/audit/route.ts

import { type NextRequest, NextResponse } from "next/server";
// Import shared types from your monorepo package
import type {
  AuditRequestBody,
  AuditResponse,
  AuditReport,
} from "@ai-audit/types";
// Import the OpenAI SDK (using v4+ syntax)
import OpenAI from "openai";

// 1. Instantiate the OpenAI client
// Ensure your OPENAI_API_KEY is set in your environment variables (e.g., apps/api/.env.local)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Define the POST handler function for the /api/audit route
export async function POST(req: NextRequest) {
  // Check if the OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured");
    const errorResponse: AuditResponse = {
      success: false,
      error: "Server configuration error: Missing API key.",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }

  try {
    // 3. Parse the request body
    const body = await req.json();

    // Basic validation (consider using Zod for more robust validation)
    const { contractCode } = body as AuditRequestBody; // Type assertion
    if (
      !contractCode ||
      typeof contractCode !== "string" ||
      contractCode.trim() === ""
    ) {
      const errorResponse: AuditResponse = {
        success: false,
        error: "Bad Request: Missing or invalid contractCode in request body.",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 4. Craft the detailed prompt for OpenAI
    const prompt = `
        Act as an expert Solidity smart contract security auditor.
        Analyze the following Solidity code for vulnerabilities, security risks, and deviations from best practices. Your analysis should be thorough.

        Identify specific issues including, but not limited to:
        - Reentrancy (Checks, Effects, Interactions pattern)
        - Integer Overflow/Underflow (using SafeMath or Solidity >=0.8.0)
        - Access Control Issues (modifier usage, ownership, authorization logic)
        - Gas Limit Issues / Denial of Service (DoS) vectors (unbounded loops, gas griefing)
        - Timestamp Dependence / Block Variable Reliance (block.timestamp, block.number)
        - Unchecked External Calls / Return Values (call, delegatecall, staticcall)
        - Front-Running Vulnerabilities (e.g., in token approvals, order books)
        - Oracle Manipulation risks
        - Improper Handling or Locking of Ether/Tokens
        - Use of deprecated Solidity features or unsafe practices (e.g., tx.origin)
        - Logic errors leading to unintended state changes or behavior
        - Precision issues with fixed-point numbers or division
        - Delegatecall vulnerabilities

        For each issue found:
        1.  **Vulnerability/Risk:** Clearly describe the issue.
        2.  **Location:** Reference the specific function name(s) and approximate line number(s) if possible.
        3.  **Impact:** Explain the potential negative consequences.
        4.  **Recommendation:** Suggest a concrete mitigation strategy or code fix.
        5.  **Severity:** Assign a severity level (e.g., Critical, High, Medium, Low, Informational).

        Structure your response clearly. If no significant issues are found, state that clearly, but still mention any minor best practice recommendations or areas for gas optimization if applicable.

        Solidity Code to Audit:
        \`\`\`solidity
        ${contractCode}
        \`\`\`

        Audit Report:
        `;

    // 5. Call the OpenAI Chat Completions endpoint
    console.log("Sending request to OpenAI..."); // Log for debugging
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Or "gpt-3.5-turbo". GPT-4 is recommended for code analysis accuracy.
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2, // Lower temperature for more factual/deterministic output
      max_tokens: 3000, // Adjust based on expected report length and model limits
      // You might add other parameters like 'n' if you want multiple completions
    });
    console.log("Received response from OpenAI."); // Log for debugging

    const aiReportContent = completion.choices[0]?.message?.content;

    if (!aiReportContent) {
      console.error("OpenAI response content is empty.");
      throw new Error("Received empty response from AI analysis.");
    }

    // 6. Format the AI's response
    const report: AuditReport = {
      aiAudit: aiReportContent.trim(),
      // Add other results here if integrating Hardhat/Slither later
    };

    const successResponse: AuditResponse = {
      success: true,
      results: report,
    };

    // 7. Return the results
    return NextResponse.json(successResponse, { status: 200 });
  } catch (error: any) {
    // 8. Include robust error handling
    console.error("Error in /api/audit:", error);

    let errorMessage = "An unexpected error occurred.";
    let statusCode = 500;

    // Handle JSON parsing errors specifically
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      errorMessage = "Bad Request: Invalid JSON format in request body.";
      statusCode = 400;
    }
    // Handle potential OpenAI API errors (check structure based on SDK v4)
    else if (error instanceof OpenAI.APIError) {
      errorMessage = `OpenAI API Error: ${error.status} ${error.name} ${error.message}`;
      statusCode = error.status || 500;
    }
    // Handle generic errors
    else if (error instanceof Error) {
      errorMessage = `Internal Server Error: ${error.message}`;
    }

    const errorResponse: AuditResponse = {
      success: false,
      error: errorMessage,
    };
    return NextResponse.json(errorResponse, { status: statusCode });
  }
}
