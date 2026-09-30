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

/**
 * Adapter for live AI generation.
 * Currently integrates with OpenAI via standard fetch.
 */
export async function generateOutlineLive(prompt: string, apiKey: string): Promise<AIResponse | AIError> {
  const model = 'gpt-3.5-turbo';
  
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) return { code: 'provider_credentials_rejected', message: 'Invalid API key provided.', status: 401 };
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
  } catch (err) {
    return { code: 'provider_temporarily_unavailable', message: 'Network error reaching provider', status: 503 };
  }
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
  
  return {
    content: `# Mock Outline for: ${prompt.substring(0, 50)}\n\n## Slide 1: Introduction\nThis is a mocked response because no live key was used.\n\n## Slide 2: Details\nWe are in development mode.\n\n## Slide 3: Conclusion\nEnd of mock.`,
    inputTokens: 0,
    outputTokens: 0,
    provider: 'mock',
    model: 'mock-model'
  };
}

export function generateUUID() {
  return crypto.randomUUID();
}
