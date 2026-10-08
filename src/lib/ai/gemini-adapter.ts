import { ILlmProvider, LlmRequest, LlmResponse } from './types';

export class GeminiProvider implements ILlmProvider {
  name = 'gemini';

  async generateResponse(request: LlmRequest): Promise<LlmResponse> {
    const rawKey = process.env.GEMINI_API_KEY?.trim() || '';
    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
    const model = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();

    if (!apiKey) {
      return {
        content: '',
        isFallback: true,
        error: 'GEMINI_API_KEY is not set',
      };
    }

    // Convert messages to Gemini contents format
    const contents: any[] = [];
    for (const msg of request.messages) {
      if (msg.role === 'system') continue; // Handled in system_instruction

      if (msg.role === 'function' && msg.name) {
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: { output: msg.content },
              },
            },
          ],
        });
      } else if (msg.functionCall) {
        contents.push({
          role: 'model',
          parts: [
            {
              functionCall: {
                name: msg.functionCall.name,
                args: msg.functionCall.arguments,
              },
            },
          ],
        });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Format tool declarations for Gemini
    const tools = request.tools && request.tools.length > 0 ? [
      {
        functionDeclarations: request.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ] : undefined;

    const payload: any = {
      contents,
    };

    if (request.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: request.systemInstruction }],
      };
    }

    if (tools) {
      payload.tools = tools;
    }

    if (request.temperature !== undefined) {
      payload.generationConfig = {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens || 1024,
      };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini API HTTP ${response.status}:`, errorText);
        return {
          content: '',
          isFallback: true,
          error: `Gemini API HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let textContent = '';
      let functionCall: { name: string; arguments: Record<string, any> } | undefined;

      for (const part of parts) {
        if (part.text) {
          textContent += part.text;
        }
        if (part.functionCall) {
          functionCall = {
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          };
        }
      }

      return {
        content: textContent,
        functionCall,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (err: any) {
      console.warn('Gemini request failed:', err?.message || err);
      return {
        content: '',
        isFallback: true,
        error: `Gemini exception: ${err?.message || String(err)}`,
      };
    }
  }
}

export const defaultLlmProvider: ILlmProvider = new GeminiProvider();
