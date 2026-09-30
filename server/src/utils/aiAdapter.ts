import crypto from 'crypto';

export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  model: string;
}

export interface AIError {
  code: string;
  message: string;
  status: number;
}

export async function generateOutlineLive(prompt: string, apiKey: string, retries = 2): Promise<AIResponse | AIError> {
  const model = 'gpt-3.5-turbo';
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000 + (attempt * 5000)); // 15s, 20s, 25s

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a carousel slide generator. Always output valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2500
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) return { code: 'provider_credentials_rejected', message: 'Invalid API key provided.', status: 401 };
        if (res.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // Exponential backoff
          continue;
        }
        if (res.status >= 500 && attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        if (res.status === 429) return { code: 'provider_quota_exhausted', message: 'Rate limit or quota exhausted.', status: 429 };
        return { code: 'provider_temporarily_unavailable', message: data.error?.message || 'Provider error', status: res.status };
      }

      return {
        content: data.choices[0].message.content,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        provider: 'openai',
        model: data.model || model,
      };
    } catch (err: any) {
      if (err.name === 'AbortError' && attempt < retries) {
        continue;
      }
      if (attempt === retries) {
        return { code: 'provider_temporarily_unavailable', message: 'Network error or timeout reaching provider', status: 503 };
      }
    }
  }
  return { code: 'provider_temporarily_unavailable', message: 'Max retries exceeded', status: 503 };
}

export interface AIImageResponse {
  url: string;
  provider: string;
  model: string;
}

export async function generateImageLive(prompt: string, apiKey: string): Promise<AIImageResponse | AIError> {
  const model = 'dall-e-3'; // Default model
  
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: '1024x1024'
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) return { code: 'provider_credentials_rejected', message: 'Invalid API key provided.', status: 401 };
      if (res.status === 429) return { code: 'provider_quota_exhausted', message: 'Rate limit or quota exhausted.', status: 429 };
      return { code: 'provider_temporarily_unavailable', message: data.error?.message || 'Provider error', status: res.status };
    }

    return {
      url: data.data[0].url,
      provider: 'openai',
      model,
    };
  } catch (err) {
    return { code: 'provider_temporarily_unavailable', message: 'Network error reaching provider', status: 503 };
  }
}

/**
 * Development mock for generating an outline without a live key.
 */
export async function generateOutlineMock(prompt: string): Promise<AIResponse> {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mockSlides = {
    slides: [
      { layout: 'cover', heading: `Mock: ${prompt.substring(0, 50)}`, body: 'This is a mocked response because no live key was used.' },
      { layout: 'explanation', heading: 'Development Mode', body: 'This system gracefully falls back to mock responses.' },
      { layout: 'closing', heading: 'End of Mock', body: 'Ready for production.' }
    ]
  };

  return {
    content: JSON.stringify(mockSlides),
    inputTokens: 0,
    outputTokens: 0,
    provider: 'mock',
    model: 'mock-model'
  };
}

export function generateUUID() {
  return crypto.randomUUID();
}
