import { useRef } from 'react';
import type { VSCodeAPI } from '../types';

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}

export function useVSCode(): VSCodeAPI {
  const vscodeRef = useRef<VSCodeAPI>();
  
  if (!vscodeRef.current) {
    vscodeRef.current = window.acquireVsCodeApi();
  }
  
  return vscodeRef.current;
}
