import ReactDOM from 'react-dom/client';
import { App } from './App';
import { 
  provideVSCodeDesignSystem, 
  vsCodeButton, 
  vsCodeTextArea, 
  vsCodeProgressRing 
} from '@vscode/webview-ui-toolkit';

console.log('[main] Starting CodeLab WebView...');

// Регистрация VS Code компонентов
console.log('[main] Registering VS Code design system components...');
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeTextArea(),
  vsCodeProgressRing()
);
console.log('[main] VS Code components registered');

const rootElement = document.getElementById('root');
console.log('[main] Root element:', rootElement);

if (!rootElement) {
  console.error('[main] ERROR: Root element not found!');
} else {
  console.log('[main] Creating React root...');
  const root = ReactDOM.createRoot(rootElement);
  
  console.log('[main] Rendering App component...');
  root.render(
    <App />
  );
  console.log('[main] App component rendered');
}
