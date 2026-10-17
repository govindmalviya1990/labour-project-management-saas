import { ILlmProvider, LlmRequest, LlmResponse } from './types';

let activeModelCache: string | null = null;
let hasLoggedModelStartup = false;

function normalizeSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const copy: any = { ...schema };
  if (typeof copy.type === 'string') {
    copy.type = copy.type.toUpperCase();
  }
  if (copy.properties) {
    const newProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(copy.properties)) {
      newProps[k] = normalizeSchema(v);
    }
    copy.properties = newProps;
  }
  if (copy.items) {
    copy.items = normalizeSchema(copy.items);
  }
  return copy;
}

export let lastDiscoveredModels: string[] = [];

export async function resolveWorkingModel(apiKey: string, preferredModel?: string): Promise<string> {
  if (activeModelCache) {
    return activeModelCache;
  }

  let initial = (preferredModel || process.env.GEMINI_MODEL || '').trim();

  try {
    const listRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: {
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (listRes.ok) {
      const data = await listRes.json();
      const rawModels: string[] = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));

      lastDiscoveredModels = rawModels;

      const priorityOrder = [
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-8b',
        'gemini-pro',
      ];

      if (initial && rawModels.includes(initial)) {
        activeModelCache = initial;
      } else {
        for (const p of priorityOrder) {
          if (rawModels.includes(p)) {
            activeModelCache = p;
            break;
          }
        }
        if (!activeModelCache && rawModels.length > 0) {
          activeModelCache = rawModels[0];
        }
      }

      if (activeModelCache && !hasLoggedModelStartup) {
        console.log(`[AI_MODEL] Selected active model: ${activeModelCache}`);
        hasLoggedModelStartup = true;
      }

      if (activeModelCache) {
        return activeModelCache;
      }
    } else {
      const errText = await listRes.text();
      console.error(`[AI_MODEL] Failed to query Gemini models list. HTTP status: ${listRes.status}, reason: ${errText.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.error(`[AI_MODEL] Error during Gemini model discovery: ${err?.message || String(err)}`);
  }

  activeModelCache = initial || 'gemini-3-flash-preview';
  if (!hasLoggedModelStartup) {
    console.log(`[AI_MODEL] Fallback default model: ${activeModelCache}`);
    hasLoggedModelStartup = true;
  }
  return activeModelCache;
}

export class GeminiProvider implements ILlmProvider {
  name = 'gemini';

  async generateResponse(request: LlmRequest): Promise<LlmResponse> {
    const rawKey = process.env.GEMINI_API_KEY?.trim() || '';
    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();

    if (!apiKey) {
      return {
        content: '',
        isFallback: true,
        error: 'GEMINI_API_KEY is not set',
      };
    }

    const startTime = Date.now();
    const timeoutMs = request.timeoutMs || 20000;
    const model = await resolveWorkingModel(apiKey, process.env.GEMINI_MODEL);

    // Convert messages to Gemini contents format
    const contents: any[] = [];
    for (const msg of request.messages) {
      if (msg.role === 'system') continue; // Handled in system_instruction

      if (msg.rawParts && Array.isArray(msg.rawParts) && msg.rawParts.length > 0) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: msg.rawParts,
        });
      } else if (msg.role === 'function' && msg.name) {
        let functionResponseData: any;
        try {
          functionResponseData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        } catch {
          functionResponseData = { output: msg.content };
        }
        contents.push({
          role: 'user', // Gemini REST v1beta requires user role for function responses
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: typeof functionResponseData === 'object' && functionResponseData !== null
                  ? functionResponseData
                  : { output: functionResponseData },
              },
            },
          ],
        });
      } else if (msg.functionCalls && msg.functionCalls.length > 0) {
        contents.push({
          role: 'model',
          parts: msg.functionCalls.map((fc) => ({
            functionCall: {
              name: fc.name,
              args: fc.arguments,
              ...(fc.id ? { id: fc.id } : {}),
            },
          })),
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
          parts: [{ text: msg.content || '' }],
        });
      }
    }

    // Format tool declarations for Gemini with normalized schema
    const tools = request.tools && request.tools.length > 0 ? [
      {
        functionDeclarations: request.tools.map((t) => {
          const hasProps = t.parameters?.properties && Object.keys(t.parameters.properties).length > 0;
          return {
            name: t.name,
            description: t.description,
            parameters: hasProps ? normalizeSchema(t.parameters) : undefined,
          };
        }),
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

    payload.generationConfig = {
      temperature: request.temperature !== undefined ? request.temperature : 0.2,
      maxOutputTokens: request.maxTokens || 1024,
    };

    const candidateModels = Array.from(new Set([
      model,
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ]));

    let lastError = '';

    for (const currentModel of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `HTTP ${response.status} (${currentModel}): ${errorText.slice(0, 200)}`;
          console.warn(`Gemini attempt failed for ${currentModel}: ${lastError}`);
          if (response.status === 503) {
            continue;
          }
          break;
        }

        const data = await response.json();
        activeModelCache = currentModel;

        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        let textContent = '';
        const functionCalls: Array<{ name: string; arguments: Record<string, any>; id?: string }> = [];

        for (const part of parts) {
          if (part.text) {
            textContent += part.text;
          }
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              arguments: part.functionCall.args || {},
              id: part.functionCall.id,
            });
          }
        }

        const latencyMs = Date.now() - startTime;

        return {
          content: textContent,
          functionCall: functionCalls[0],
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
          rawParts: parts,
          model: currentModel,
          latencyMs,
          usage: {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0,
          },
        };
      } catch (err: any) {
        lastError = `Exception (${currentModel}): ${err?.message || String(err)}`;
        console.warn(`Gemini attempt error for ${currentModel}: ${lastError}`);
        continue;
      }
    }

    return {
      content: '',
      isFallback: true,
      error: `Gemini API failed across models: ${lastError}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

export const defaultLlmProvider: ILlmProvider = new GeminiProvider();
