import { ILlmProvider, LlmRequest, LlmResponse } from './types';

let activeModelCache: string | null = null;

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

async function resolveWorkingModel(apiKey: string, preferredModel?: string): Promise<string> {
  if (activeModelCache && !activeModelCache.includes('2.5-flash')) {
    return activeModelCache;
  }
  activeModelCache = null;

  let initial = (preferredModel || process.env.GEMINI_MODEL || '').trim();
  if (initial.includes('2.5-flash')) {
    initial = 'gemini-3.8-flash';
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const rawModels: string[] = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));

      lastDiscoveredModels = rawModels;
      const validModels = rawModels.filter((name: string) => !name.includes('2.5-flash'));

      if (initial && validModels.includes(initial)) {
        activeModelCache = initial;
        return initial;
      }

      const priorityOrder = [
        'gemini-3.8-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-pro',
      ];

      for (const p of priorityOrder) {
        if (validModels.includes(p)) {
          activeModelCache = p;
          return p;
        }
      }

      if (validModels.length > 0) {
        activeModelCache = validModels[0];
        return validModels[0];
      }
    }
  } catch (err) {
    console.warn('Failed to query Gemini models list:', err);
  }

  return initial || 'gemini-3.8-flash';
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

    let model = await resolveWorkingModel(apiKey, process.env.GEMINI_MODEL);

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

    if (request.temperature !== undefined) {
      payload.generationConfig = {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens || 1024,
      };
    }

    try {
      let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // If 404, model name was rejected; discover valid model from list and retry once
      if (response.status === 404) {
        activeModelCache = null;
        const freshModel = await resolveWorkingModel(apiKey);
        if (freshModel && freshModel !== model) {
          model = freshModel;
          url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini API HTTP ${response.status} (${model}):`, errorText);
        return {
          content: '',
          isFallback: true,
          error: `Gemini API HTTP ${response.status} (${model}) [Discovered: ${lastDiscoveredModels.join(', ')}]: ${errorText}`,
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
