import React, { useEffect, useState, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useAuthStore } from '../store/authStore';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { SlideStrip } from './SlideStrip';
import { CanvasArea } from './CanvasArea';
import { MobilePropertySheet } from './MobilePropertySheet';

export const CarouselEditor: React.FC = () => {
  const { project, initProject, loadProject, setSyncStatus } = useEditorStore();
  const [isLoading, setIsLoading] = useState(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Attempt to load from IndexedDB
    import('../utils/db').then(({ loadAllProjects, saveProject }) => {
      loadAllProjects().then(projects => {
        if (projects && projects.length > 0) {
          const recentProject = projects.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          loadProject(recentProject);
        } else {
          initProject();
        }
        setIsLoading(false);
      });
      
      const unsub = useEditorStore.subscribe((state, prevState) => {
        if (state.project && state.project !== prevState.project) {
          // 1. Save locally
          saveProject(state.project).catch(console.error);
          
          // 2. Notify other tabs
          const channel = new BroadcastChannel('carousel_editor_sync');
          channel.postMessage({ type: 'PROJECT_UPDATED', projectId: state.project.id, revision: state.project.revision });
          channel.close();

          // 3. Sync to Cloud
          const token = useAuthStore.getState().token;
          if (token) {
            setSyncStatus(true);
            
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            
            syncTimeoutRef.current = setTimeout(() => {
              // We check if it exists on cloud, if so PUT, else POST.
              // For simplicity, we can do a PUT and if 404, fallback to POST
              fetch(`http://localhost:3001/api/projects/${state.project!.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(state.project)
              }).then(async res => {
                if (res.status === 404) {
                  return fetch(`http://localhost:3001/api/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(state.project)
                  });
                }
                return res;
              })
              .then(res => {
                if (res.ok) setSyncStatus(false, new Date());
                else setSyncStatus(false);
              })
              .catch(() => setSyncStatus(false));
            }, 1000);
          }
        }
      });
      
      // Setup conflict detection listener
      const syncChannel = new BroadcastChannel('carousel_editor_sync');
      syncChannel.onmessage = (event) => {
        if (event.data?.type === 'PROJECT_UPDATED') {
          const currentProject = useEditorStore.getState().project;
          if (currentProject && currentProject.id === event.data.projectId && currentProject.revision < event.data.revision) {
            alert('Warning: This project was updated in another tab. Saving here may overwrite those changes. Please reload to see the latest version.');
          }
        }
      };
      
      return () => {
        unsub();
        syncChannel.close();
      };
    });
  }, [initProject, loadProject]);

  if (isLoading || !project) {
    return <div className="flex h-screen bg-neutral-900 items-center justify-center text-white">Loading Editor...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      <TopBar />
      
      <div className="flex flex-1 overflow-hidden relative">
        <LeftPanel />
        <CanvasArea />
        <RightPanel />
        <MobilePropertySheet />
      </div>
      
      <SlideStrip />
    </div>
  );
};
