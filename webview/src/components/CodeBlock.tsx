import React, { useState, useMemo } from 'react';
import hljs from 'highlight.js';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useVSCode } from '../hooks/useVSCode';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ code, language }) => {
  const vscode = useVSCode();
  const [copied, setCopied] = useState(false);
  
  const highlightedCode = useMemo(() => {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      return hljs.highlightAuto(code).value;
    }
  }, [code, language]);
  
  const handleCopy = () => {
    vscode.postMessage({
      type: 'copyCode',
      code
    });
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={styles.codeBlock}>
      <div className={styles.header}>
        <span className={styles.language}>{language}</span>
        <VSCodeButton
          appearance="secondary"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
        >
          <span slot="start" className={`codicon codicon-${copied ? 'check' : 'copy'}`} />
          {copied ? 'Copied!' : 'Copy'}
        </VSCodeButton>
      </div>
      <pre className={styles.pre}>
        <code
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
