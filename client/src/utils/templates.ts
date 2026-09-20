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
        // Placeholder for an image element, just using a shape/text for now
        {
          id: uuidv4(),
          type: 'shape',
          role: 'decoration',
          shapeType: 'rectangle',
          left: 0,
          top: 0,
          width: 1080,
          height: 600,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#e5e7eb'
        } as any,
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
          type: 'shape',
          role: 'decoration',
          shapeType: 'rectangle',
          left: 100,
          top: 500,
          width: 880,
          height: 480,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#e5e7eb'
        } as any
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
          type: 'shape',
          role: 'decoration',
          shapeType: 'rectangle',
          left: 340,
          top: 200,
          width: 400,
          height: 400,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#e5e7eb'
        } as any,
        createText('Read the full article\nat architectural.xyz', 100, 700, 48, 'normal', '#111827', 'heading', 880, 'center'),
      ]
    })
  }
};
