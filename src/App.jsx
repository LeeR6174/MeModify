import { useState, useRef, useEffect } from 'react'
import { Upload, Download, Trash2, FileText, CheckCircle2, ChevronRight, X, Copy, Check, RotateCcw, Maximize2, Minimize2, AlertCircle } from 'lucide-react'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [originalLines, setOriginalLines] = useState([])
  const [processedLines, setProcessedLines] = useState([])
  const [diffLines, setDiffLines] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [copying, setCopying] = useState(false)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const containerRef = useRef(null)
  const scrollPosRef = useRef(0)
  const [isFullScreen, setIsFullScreen] = useState(false)
  
  useEffect(() => {
    const updatedProcessed = diffLines
      .filter(line => line.type === 'normal')
      .map(line => line.text)
    setProcessedLines(updatedProcessed)
  }, [diffLines])

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
      // Restore scroll position after a short delay to allow layout to settle
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollPosRef.current
        }
      }, 50)
    }
    document.addEventListener('fullscreenchange', handleFullScreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange)
  }, [])

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target.result
        processText(text)
      }
      reader.readAsText(uploadedFile)
    }
  }

  const isTimestamp = (line) => {
    // Precise SRT timestamp check: 00:00:00,000 --> 00:00:00,000
    return /\d{1,2}:\d{2}:\d{2}/.test(line) && line.includes('-->')
  }

  const isException = (line) => {
    const keywords = ['의역', '직역', '순화']
    return keywords.some(keyword => line.includes(keyword))
  }

  const hasHangul = (text) => {
    return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)
  }

  const processText = (text) => {
    setIsProcessing(true)
    const lines = text.split(/\r?\n/)
    setOriginalLines(lines)

    const newDiff = []

    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      
      if (isTimestamp(line)) {
        newDiff.push({ type: 'normal', text: line })
        i++
        
        // Process content lines until next timestamp, empty line, or index line
        // SRT blocks usually end with an empty line.
        while (i < lines.length && !isTimestamp(lines[i]) && lines[i].trim() !== '') {
          // Check if next line is an index line (just a number)
          // If it's a number followed by a timestamp line, it's a new block.
          if (/^\d+$/.test(lines[i].trim()) && i + 1 < lines.length && isTimestamp(lines[i+1])) {
            break;
          }

          const contentLine = lines[i]
          const isExp = isException(contentLine)
          if (hasHangul(contentLine) && !isExp) {
            newDiff.push({ type: 'removed', text: contentLine })
          } else {
            newDiff.push({ type: 'normal', text: contentLine, isException: isExp })
          }
          i++
        }
      } else {
        const isExp = isException(line)
        newDiff.push({ type: 'normal', text: line, isException: isExp })
        i++
      }
    }

    setDiffLines(newDiff)
    setIsProcessing(false)
  }

  const handleLineEdit = (idx, newText) => {
    const updatedDiff = [...diffLines]
    updatedDiff[idx].text = newText
    setDiffLines(updatedDiff)
  }

  const handleLineDelete = (idx) => {
    const updatedDiff = [...diffLines]
    updatedDiff[idx] = { ...updatedDiff[idx], type: 'removed' }
    setDiffLines(updatedDiff)
  }

  const handleLineRestore = (idx) => {
    const updatedDiff = [...diffLines]
    updatedDiff[idx] = { ...updatedDiff[idx], type: 'normal' }
    setDiffLines(updatedDiff)
  }

  const handleDownload = () => {
    const content = processedLines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    // File name: original_fixed.ext
    const originalName = file.name
    const lastDotIndex = originalName.lastIndexOf('.')
    let newName
    if (lastDotIndex === -1) {
      newName = `${originalName}_fixed`
    } else {
      const name = originalName.substring(0, lastDotIndex)
      const ext = originalName.substring(lastDotIndex)
      newName = `${name}_fixed${ext}`
    }
    
    a.download = newName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    const content = processedLines.join('\n')
    await navigator.clipboard.writeText(content)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  const toggleFullScreen = () => {
    if (scrollRef.current) {
      scrollPosRef.current = scrollRef.current.scrollTop
    }
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const reset = () => {
    setFile(null)
    setOriginalLines([])
    setProcessedLines([])
    setDiffLines([])
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="container" ref={containerRef}>
      <header className="animate-fade-in main-header">
        <div className="logo-badge">Me</div>
        <h1>MeModify</h1>
        <p className="subtitle">字幕韓国語行削除ツール <span className="version-tag">v1.0</span></p>
      </header>

      <main>
        {!file ? (
          <div 
            className={`glass upload-area animate-fade-in ${isDragging ? 'dragging' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const droppedFile = e.dataTransfer.files[0]
              if (droppedFile) {
                setFile(droppedFile)
                const reader = new FileReader()
                reader.onload = (event) => processText(event.target.result)
                reader.readAsText(droppedFile)
              }
            }}
          >
            <div className="upload-icon">
              <Upload size={48} className={isDragging ? 'animate-bounce' : ''} />
            </div>
            <h3>ファイルをアップロード</h3>
            <p>ここにファイルをドラッグ＆ドロップ、またはクリックして選択</p>
            <div className="hints-container">
              <span className="hint-tag">SRT</span>
              <span className="hint-tag">TXT</span>
              <span className="hint-tag">UTF-8</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              style={{ display: 'none' }}
              accept=".txt,.srt"
            />
          </div>
        ) : (
          <div className="glass diff-container animate-fade-in">
            <div className="diff-header">
              <div className="file-info">
                <div className="file-icon-wrapper">
                  <FileText size={18} />
                </div>
                <div className="file-meta">
                  <span className="filename">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <span className="status-tag">解析完了</span>
              </div>
              <div className="actions">
                <button className="btn-secondary" onClick={toggleFullScreen} title="フル画面モード">
                  {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  {isFullScreen ? '解除' : 'フル画面'}
                </button>
                <button className="btn-secondary" onClick={reset}>
                  <X size={18} /> 閉じる
                </button>
                <button className="btn-secondary" onClick={handleCopy}>
                  {copying ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
                  {copying ? 'コピーしました' : 'クリップボード'}
                </button>
                <button className="btn-primary" onClick={handleDownload}>
                  <Download size={18} /> ダウンロード
                </button>
              </div>
            </div>

            <div className="diff-stats">
              <div className="stat-item">
                <span className="stat-label">元データ:</span>
                <span className="stat-value text-primary">{originalLines.length} 行</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">削除済み:</span>
                <span className="stat-value text-removed">-{diffLines.filter(l => l.type === 'removed').length} 行</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">修正後:</span>
                <span className="stat-value text-success">{processedLines.length} 行</span>
              </div>
            </div>

            <div className="diff-content" ref={scrollRef}>
              {diffLines.map((line, idx) => (
                <div key={idx} className={`diff-line ${line.type === 'removed' ? 'line-removed' : 'line-normal'} ${line.isException ? 'line-exception' : ''}`}>
                  <span className="line-number">{idx + 1}</span>
                  {line.type === 'removed' ? (
                    <div className="line-content-wrapper">
                      <span className="line-content">
                        <Trash2 size={12} className="inline-icon" />
                        {line.text}
                      </span>
                      <button 
                        className="btn-line-restore" 
                        onClick={() => handleLineRestore(idx)}
                        title="この行を復元"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="line-content-wrapper">
                      {line.isException && (
                        <span className="exception-badge" contentEditable={false}>
                          <AlertCircle size={12} /> 要確認
                        </span>
                      )}
                      <div 
                        className="line-content editable"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleLineEdit(idx, e.target.innerText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.target.blur()
                          }
                        }}
                      >
                        {line.text}
                      </div>
                      <button 
                        className="btn-line-delete" 
                        onClick={() => handleLineDelete(idx)}
                        title="この行を削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="animate-fade-in">
        <div className="footer-content">
          <p>&copy; 2026 MeModify • ローカル処理 • プライバシー保護</p>
        </div>
      </footer>
    </div>
  )
}

export default App
