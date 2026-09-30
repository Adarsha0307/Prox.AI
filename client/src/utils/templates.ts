import { v4 as uuidv4 } from 'uuid';
import type { Slide, TextElement } from '../types/schema';

// Helper to create text elements easily
const createText = (
  text: string, 
  left: number, 
  top: number, 
  fontSize: number, 
  fontWeight: 'normal' | 'bold', 
  color: string, 
  role: 'heading' | 'body' | 'image' | 'footer' | 'background',
  width: number = 800,
  textAlign: 'left' | 'center' | 'right' = 'left'
): TextElement => ({
  id: uuidv4(),
  type: 'text',
  role,
  text,
  left,
  top,
  width,
  height: fontSize * 1.5,
  rotation: 0,
  opacity: 1,
  locked: false,
  fontFamily: 'Inter',
  fontSize,
  fontWeight,
  fontStyle: 'normal',
  textAlign,
  fill: color,
  lineHeight: 1.2,
  charSpacing: 0
});

export const templates = {
  minimal: {
    name: 'Minimal Professional',
    cover: (): Slide => ({
      id: uuidv4(),
      background: '#ffffff',
      elements: [
        createText('A Minimal Approach\nTo Professional Growth', 140, 300, 80, 'bold', '#111827', 'heading'),
        createText('Swipe to learn more', 140, 800, 32, 'normal', '#6b7280', 'body')
      ]
    }),
    explanation: (): Slide => ({
      id: uuidv4(),
      background: '#ffffff',
      elements: [
        createText('The Concept', 140, 140, 48, 'bold', '#111827', 'heading'),
        createText('Minimalism is not about having less, it\'s about making room for more of what matters. By removing distractions, we can focus entirely on the core message.', 140, 260, 40, 'normal', '#374151', 'body')
      ]
    }),
    list: (): Slide => ({
      id: uuidv4(),
      background: '#ffffff',
      elements: [
        createText('Key Principles', 140, 140, 48, 'bold', '#111827', 'heading'),
        createText('1. Keep it simple\n\n2. Focus on typography\n\n3. Use ample whitespace\n\n4. Remove the unnecessary', 140, 260, 40, 'normal', '#374151', 'body')
      ]
    }),
    quote: (): Slide => ({
      id: uuidv4(),
      background: '#f3f4f6',
      elements: [
        createText('"Simplicity is the ultimate sophistication."', 140, 400, 64, 'bold', '#111827', 'heading', 800, 'center'),
        createText('- Leonardo da Vinci', 140, 600, 32, 'normal', '#6b7280', 'body', 800, 'center')
      ]
    }),
    closing: (): Slide => ({
      id: uuidv4(),
      background: '#111827',
      elements: [
        createText('Ready to simplify?', 140, 300, 80, 'bold', '#ffffff', 'heading'),
        createText('Follow for more insights', 140, 800, 40, 'normal', '#9ca3af', 'body')
      ]
    })
  },
  bold: {
    name: 'Bold Educational',
    cover: (): Slide => ({
      id: uuidv4(),
      background: '#ef4444',
      elements: [
        createText('STOP DOING THIS\nIN REACT', 100, 300, 96, 'bold', '#ffffff', 'heading'),
        createText('A quick guide to better components', 100, 800, 36, 'bold', '#fee2e2', 'body')
      ]
    }),
    explanation: (): Slide => ({
      id: uuidv4(),
      background: '#111827',
      elements: [
        createText('THE PROBLEM', 100, 140, 56, 'bold', '#ef4444', 'heading'),
        createText('Using index as a key in React lists can cause severe performance issues and state bugs when the list order changes.', 100, 260, 44, 'bold', '#ffffff', 'body')
      ]
    }),
    list: (): Slide => ({
      id: uuidv4(),
      background: '#ffffff',
      elements: [
        createText('THE SOLUTION', 100, 140, 56, 'bold', '#ef4444', 'heading'),
        createText('✅ Use database IDs\n\n✅ Use crypto.randomUUID()\n\n✅ Generate IDs on creation\n\n❌ Never use map(..., index)', 100, 260, 44, 'bold', '#111827', 'body')
      ]
    }),
    quote: (): Slide => ({
      id: uuidv4(),
      background: '#ef4444',
      elements: [
        createText('78%', 100, 300, 180, 'bold', '#ffffff', 'heading', 880, 'center'),
        createText('of developers have made this mistake', 100, 600, 40, 'bold', '#fee2e2', 'body', 880, 'center')
      ]
    }),
    closing: (): Slide => ({
      id: uuidv4(),
      background: '#111827',
      elements: [
        createText('DID THIS HELP?', 100, 300, 88, 'bold', '#ffffff', 'heading', 880, 'center'),
        createText('Save this post for later 📌', 100, 800, 40, 'bold', '#ef4444', 'body', 880, 'center')
      ]
    })
  },
  imageLed: {
    name: 'Image-Led Editorial',
    cover: (): Slide => ({
      id: uuidv4(),
      background: '#fafafa',
      elements: [
        // Placeholder for an image element, using a shape/text for now
        {
          id: uuidv4(),
          type: 'rectangle',
          role: 'background',
          left: 0,
          top: 0,
          width: 1080,
          height: 600,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#e5e7eb'
        },
        createText('THE FUTURE OF\nARCHITECTURE', 100, 700, 72, 'bold', '#111827', 'heading'),
      ]
    }),
    explanation: (): Slide => ({
      id: uuidv4(),
      background: '#fafafa',
      elements: [
        createText('Sustainable Design', 100, 140, 36, 'normal', '#6b7280', 'body'),
        createText('Modern architecture is increasingly focusing on environmental integration, prioritizing renewable materials and passive cooling systems.', 100, 220, 40, 'normal', '#111827', 'body'),
        {
          id: uuidv4(),
          type: 'rectangle',
          role: 'background',
          left: 100,
          top: 500,
          width: 880,
          height: 480,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#e5e7eb'
        }
      ]
    }),
    list: (): Slide => ({
      id: uuidv4(),
      background: '#fafafa',
      elements: [
        createText('Materials', 100, 140, 36, 'normal', '#6b7280', 'body'),
        createText('• Cross-laminated timber\n\n• Recycled steel\n\n• Low-carbon concrete\n\n• Bamboo', 100, 220, 48, 'normal', '#111827', 'body'),
      ]
    }),
    quote: (): Slide => ({
      id: uuidv4(),
      background: '#111827',
      elements: [
        createText('Architecture should speak of its time and place, but yearn for timelessness.', 100, 350, 64, 'normal', '#ffffff', 'heading'),
        createText('- Frank Gehry', 100, 700, 32, 'normal', '#9ca3af', 'body')
      ]
    }),
    closing: (): Slide => ({
      id: uuidv4(),
      background: '#fafafa',
      elements: [
        {
          id: uuidv4(),
          type: 'rectangle',
          role: 'background',
          left: 340,
          top: 200,
          width: 400,
          height: 400,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#e5e7eb'
        },
        createText('Read the full article\nat architectural.xyz', 100, 700, 48, 'normal', '#111827', 'heading', 880, 'center'),
      ]
    })
  },
  corporate: {
    name: 'Corporate Professional',
    cover: (): Slide => ({
      id: uuidv4(),
      background: '#1e3a5f',
      elements: [
        {
          id: uuidv4(),
          type: 'rectangle',
          role: 'background',
          left: 0,
          top: 880,
          width: 1080,
          height: 200,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#c9a84c'
        },
        createText('QUARTERLY\nBUSINESS REVIEW', 100, 200, 88, 'bold', '#ffffff', 'heading'),
        createText('Q3 2026 • Strategic Overview', 100, 910, 36, 'bold', '#1e3a5f', 'body'),
      ]
    }),
    explanation: (): Slide => ({
      id: uuidv4(),
      background: '#ffffff',
      elements: [
        {
          id: uuidv4(),
          type: 'rectangle',
          role: 'background',
          left: 0,
          top: 0,
          width: 1080,
          height: 8,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#c9a84c'
        },
        createText('Executive Summary', 100, 80, 48, 'bold', '#1e3a5f', 'heading'),
        createText('Our strategic initiatives have driven measurable growth across all business units, with particular strength in digital transformation and market expansion.', 100, 200, 38, 'normal', '#374151', 'body'),
      ]
    }),
    list: (): Slide => ({
      id: uuidv4(),
      background: '#f8f9fa',
      elements: [
        createText('Key Metrics', 100, 80, 48, 'bold', '#1e3a5f', 'heading'),
        createText('📈  Revenue: +23% YoY\n\n📊  Market Share: 34.2%\n\n👥  Team Growth: +45 hires\n\n⭐  NPS Score: 72', 100, 220, 42, 'normal', '#374151', 'body'),
      ]
    }),
    quote: (): Slide => ({
      id: uuidv4(),
      background: '#1e3a5f',
      elements: [
        createText('"Innovation distinguishes\nbetween a leader\nand a follower."', 100, 250, 60, 'bold', '#c9a84c', 'heading', 880, 'center'),
        createText('— Steve Jobs', 100, 700, 32, 'normal', '#8badd4', 'body', 880, 'center'),
      ]
    }),
    closing: (): Slide => ({
      id: uuidv4(),
      background: '#1e3a5f',
      elements: [
        createText('THANK YOU', 100, 300, 96, 'bold', '#c9a84c', 'heading', 880, 'center'),
        createText('Questions? → contact@company.com', 100, 800, 32, 'normal', '#8badd4', 'body', 880, 'center'),
      ]
    })
  },
  pastel: {
    name: 'Pastel Creative',
    cover: (): Slide => ({
      id: uuidv4(),
      background: '#fef3f2',
      elements: [
        {
          id: uuidv4(),
          type: 'circle',
          role: 'background',
          left: 700,
          top: -100,
          width: 500,
          height: 500,
          rotation: 0,
          opacity: 0.6,
          locked: false,
          fill: '#fecaca'
        },
        {
          id: uuidv4(),
          type: 'circle',
          role: 'background',
          left: -100,
          top: 700,
          width: 400,
          height: 400,
          rotation: 0,
          opacity: 0.5,
          locked: false,
          fill: '#bfdbfe'
        },
        createText('Creative\nInspiration', 120, 300, 88, 'bold', '#9f1239', 'heading'),
        createText('A journey through color and form', 120, 700, 36, 'normal', '#be123c', 'body'),
      ]
    }),
    explanation: (): Slide => ({
      id: uuidv4(),
      background: '#fef9ef',
      elements: [
        createText('The Philosophy', 120, 120, 48, 'bold', '#b45309', 'heading'),
        createText('Pastel palettes create a sense of calm and approachability. They invite the viewer in, making complex ideas feel gentle and accessible.', 120, 260, 40, 'normal', '#78350f', 'body'),
      ]
    }),
    list: (): Slide => ({
      id: uuidv4(),
      background: '#f0fdf4',
      elements: [
        createText('Color Theory', 120, 120, 48, 'bold', '#15803d', 'heading'),
        createText('🌸  Rose — warmth & empathy\n\n🌊  Sky — trust & clarity\n\n🌿  Sage — growth & balance\n\n☀️  Honey — optimism & energy', 120, 260, 40, 'normal', '#166534', 'body'),
      ]
    }),
    quote: (): Slide => ({
      id: uuidv4(),
      background: '#eff6ff',
      elements: [
        createText('"Color is a power which\ndirectly influences the soul."', 100, 300, 60, 'bold', '#1e40af', 'heading', 880, 'center'),
        createText('— Wassily Kandinsky', 100, 650, 32, 'normal', '#3b82f6', 'body', 880, 'center'),
      ]
    }),
    closing: (): Slide => ({
      id: uuidv4(),
      background: '#fdf4ff',
      elements: [
        createText('Let\'s Create\nTogether ✨', 120, 300, 80, 'bold', '#86198f', 'heading', 880, 'center'),
        createText('Follow for daily design inspiration', 120, 750, 36, 'normal', '#a855f7', 'body', 880, 'center'),
      ]
    })
  },
  dark: {
    name: 'Dark Mode Tech',
    cover: (): Slide => ({
      id: uuidv4(),
      background: '#0a0a0a',
      elements: [
        {
          id: uuidv4(),
          type: 'rectangle',
          role: 'background',
          left: 0,
          top: 950,
          width: 1080,
          height: 130,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#7c3aed'
        },
        createText('SYSTEM\nARCHITECTURE', 100, 250, 96, 'bold', '#ffffff', 'heading'),
        createText('A deep dive into modern infrastructure', 100, 970, 32, 'bold', '#ffffff', 'body'),
      ]
    }),
    explanation: (): Slide => ({
      id: uuidv4(),
      background: '#0f172a',
      elements: [
        createText('// The Stack', 100, 100, 52, 'bold', '#7c3aed', 'heading'),
        createText('Modern distributed systems rely on event-driven architectures, containerised deployments, and observability-first practices to achieve reliability at scale.', 100, 240, 40, 'normal', '#cbd5e1', 'body'),
      ]
    }),
    list: (): Slide => ({
      id: uuidv4(),
      background: '#0f172a',
      elements: [
        createText('Tech Radar', 100, 100, 52, 'bold', '#7c3aed', 'heading'),
        createText('→  TypeScript + React\n\n→  Node.js / Deno / Bun\n\n→  PostgreSQL + Redis\n\n→  Docker + Kubernetes\n\n→  Grafana + Prometheus', 100, 240, 40, 'normal', '#94a3b8', 'body'),
      ]
    }),
    quote: (): Slide => ({
      id: uuidv4(),
      background: '#0a0a0a',
      elements: [
        createText('10x', 100, 200, 220, 'bold', '#7c3aed', 'heading', 880, 'center'),
        createText('improvement in deployment\nfrequency after migration', 100, 550, 44, 'normal', '#e2e8f0', 'body', 880, 'center'),
      ]
    }),
    closing: (): Slide => ({
      id: uuidv4(),
      background: '#0a0a0a',
      elements: [
        createText('$ git push origin main', 100, 350, 52, 'bold', '#4ade80', 'heading', 880, 'center'),
        createText('Follow for engineering insights ⚡', 100, 750, 36, 'normal', '#7c3aed', 'body', 880, 'center'),
      ]
    })
  }
};
