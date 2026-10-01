import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Wand2 } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useAuthStore } from '../store/authStore';
import { apiRequest, apiUrl } from '../utils/api';
import { saveAsset } from '../utils/db';
import { readImageDimensions } from '../utils/assets';

export const ImagePanel: React.FC = () => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((state) => state.token);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const addElement = useEditorStore((state) => state.addElement);
  const setStatusMessage = useEditorStore((state) => state.setStatusMessage);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    if (!token) {
      setStatusMessage('You must be signed in to generate images.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Attempting to generate image...');
    setPreviewImage(null);

    try {
      const result = await apiRequest<{ url: string }>('/api/generate/image', {
        method: 'POST',
        token,
        body: { prompt: aiPrompt }
      });

      if (!result.ok) {
        const err = (result as { ok: false; error: any }).error;
        if (err.code === 'provider_capability_unsupported' || err.status === 501) {
          throw new Error('Image generation is unavailable (No provider configured). Please configure BYOK key.');
        }
        if (err.code === 'platform_funding_disabled' || err.status === 402) {
          throw new Error('Platform funding is disabled. Please configure your API key in Settings (BYOK).');
        }
        throw new Error(err.message || 'Failed to generate');
      }
      
      // The server serves generated images from /uploads/:filename behind an
      // owner-scoped token. Attach it to the preview URL so the <img> tag and
      // the apply-fetch can actually load the image (D-03).
      const assetUrl = apiUrl(result.data.url);
      const separator = assetUrl.includes('?') ? '&' : '?';
      setPreviewImage(`${assetUrl}${separator}token=${encodeURIComponent(token)}`);
      setStatusMessage('Image generated successfully. Preview before applying.');
      void refreshUser();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown generation error';
      setStatusMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Resizes the file (if needed), converts it to a Blob, stores it in IndexedDB
   * via saveAsset, and adds an element with assetId (not a data URL). This
   * prevents document bloat and keeps local uploads consistent with AI-generated
   * images (D-04 / B-04).
   */
  const processAndInsertImage = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = async () => {
          try {
            let { width, height } = img;
            const MAX_DIM = 1920;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');
            ctx.drawImage(img, 0, 0, width, height);

            // Preserve original mime type if PNG/WebP, otherwise JPEG
            let mimeType = file.type;
            if (mimeType !== 'image/png' && mimeType !== 'image/webp') {
              mimeType = 'image/jpeg';
            }
            const quality = mimeType === 'image/png' ? undefined : 0.8;

            canvas.toBlob(async (blob) => {
              try {
                if (!blob) throw new Error('Canvas toBlob failed');

                // Enforce 5MB limit
                if (blob.size > 5 * 1024 * 1024) {
                  throw new Error('Image is too large even after compression (limit ~5MB).');
                }

                const assetId = crypto.randomUUID();
                await saveAsset({
                  id: assetId,
                  blob,
                  name: file.name || `upload-${assetId.slice(0, 8)}.${mimeType.split('/')[1]}`,
                  type: mimeType,
                  size: blob.size,
                  createdAt: Date.now(),
                });

                // Fit image into the canvas area
                const canvasDims = useEditorStore.getState().project?.dimensions ?? { width: 1080, height: 1080 };
                const maxWidth = canvasDims.width * 0.8;
                const maxHeight = canvasDims.height * 0.8;
                const scale = Math.min(maxWidth / width, maxHeight / height, 1);
                const elWidth = Math.max(16, Math.round(width * scale));
                const elHeight = Math.max(16, Math.round(height * scale));

                addElement({
                  id: crypto.randomUUID(),
                  type: 'image',
                  role: 'image',
                  assetId,
                  fit: 'cover',
                  left: Math.round((canvasDims.width - elWidth) / 2),
                  top: Math.round((canvasDims.height - elHeight) / 2),
                  width: elWidth,
                  height: elHeight,
                  rotation: 0,
                  opacity: 1,
                  locked: false,
                } as any);

                resolve();
              } catch (err) {
                reject(err);
              }
            }, mimeType, quality);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for compression.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatusMessage('Processing and compressing image...');

    try {
      await processAndInsertImage(file);
      setStatusMessage('Image inserted successfully.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unknown error processing image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Applies the generated image by persisting it into IndexedDB first. The
   * project then references an assetId (like any uploaded image) instead of a
   * short-lived /uploads/* URL, so reloads, exports, and the 24 h uploads purge
   * can never break it (D-04 / D-14).
   */
  const applyGeneratedImage = async () => {
    if (!previewImage) return;
    setStatusMessage('Processing and compressing image...');
    try {
      const res = await fetch(previewImage);
      if (!res.ok) {
        throw new Error(`Generated image is unavailable (${res.status}). Regenerate it if it expired.`);
      }
      const blob = await res.blob();

      // The server output is already a compressed PNG/JPEG within the upload
      // limits, so it is stored as-is inside IndexedDB (no client re-compress).

      const dimensions = await readImageDimensions(blob);
      const assetId = crypto.randomUUID();
      await saveAsset({
        id: assetId,
        blob,
        name: `generated-${assetId.slice(0, 8)}-${Date.now()}.png`,
        type: blob.type || 'image/png',
        size: blob.size,
        createdAt: Date.now(),
      });

      // Fit the image into the canvas (matches the addImageFromFile behaviour).
      const canvas = useEditorStore.getState().project?.dimensions ?? { width: 1080, height: 1080 };
      const maxWidth = canvas.width * 0.8;
      const maxHeight = canvas.height * 0.8;
      const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1);
      const width = Math.max(16, Math.round(dimensions.width * scale));
      const height = Math.max(16, Math.round(dimensions.height * scale));

      addElement({
        id: crypto.randomUUID(),
        type: 'image',
        role: 'image',
        assetId,
        fit: 'cover',
        left: Math.round((canvas.width - width) / 2),
        top: Math.round((canvas.height - height) / 2),
        width,
        height,
        rotation: 0,
        opacity: 1,
        locked: false,
      } as any);

      setPreviewImage(null);
      setStatusMessage('Image applied successfully.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to process generated image.');
    }
  };

  return (
    <div className="p-4 flex-1 flex flex-col overflow-y-auto">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ImageIcon size={16} /> Images & Assets
      </h2>
      
      <div className="space-y-6">
        <div>
          <label className="text-xs text-neutral-500 mb-2 block">Upload Custom Image</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png, image/jpeg, image/webp"
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white p-3 rounded text-sm border border-dashed border-neutral-600 transition-colors flex justify-center items-center gap-2"
          >
            <Upload size={16} /> 
            {isUploading ? 'Processing...' : 'Browse Images'}
          </button>
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-neutral-700"></div>
          <span className="flex-shrink-0 mx-2 text-xs text-neutral-500">OR GENERATE</span>
          <div className="flex-grow border-t border-neutral-700"></div>
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">AI Image Prompt (Mock)</label>
          <textarea 
            placeholder="A futuristic city with flying cars..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="w-full bg-neutral-800 text-white p-2 rounded text-sm border border-neutral-700 outline-none h-24 resize-none mb-2"
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !aiPrompt.trim()}
            className="w-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white p-2 rounded text-xs transition-colors flex justify-center items-center gap-2"
          >
            {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 size={14} />}
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>

          {previewImage && (
            <div className="mt-4 p-2 border border-neutral-700 rounded bg-neutral-800/50">
              <label className="text-xs text-neutral-500 mb-2 block">Generated Preview:</label>
              <img src={previewImage} alt="Generated Preview" className="w-full rounded mb-2 object-cover aspect-square" />
              <div className="flex gap-2">
                <button
                  onClick={applyGeneratedImage}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded text-xs transition-colors"
                >
                  Apply to Canvas
                </button>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white p-2 rounded text-xs transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

