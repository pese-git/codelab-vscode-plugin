import React from 'react';
import './styles/global.css';

// Простая версия App для тестирования
export const App: React.FC = () => {
  console.log('Simple App rendering...');
  
  return (
    <div className="app" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      padding: '16px',
      backgroundColor: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)'
    }}>
      <div style={{ 
        padding: '12px', 
        borderBottom: '1px solid var(--vscode-panel-border)',
        marginBottom: '16px'
      }}>
        <h2 style={{ margin: 0 }}>CodeLab Chat (Test)</h2>
      </div>
      
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        marginBottom: '16px',
        border: '1px solid var(--vscode-panel-border)',
        padding: '8px'
      }}>
        <p>Message List Area</p>
        <p>If you see this, React is working!</p>
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: '8px',
        borderTop: '1px solid var(--vscode-panel-border)',
        paddingTop: '8px'
      }}>
        <input 
          type="text" 
          placeholder="Type message..." 
          style={{ 
            flex: 1,
            padding: '8px',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)'
          }}
        />
        <button style={{
          padding: '8px 16px',
          backgroundColor: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          cursor: 'pointer'
        }}>
          Send
        </button>
      </div>
    </div>
  );
};
