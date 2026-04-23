import { useState, useRef, useEffect } from 'react'
import { Upload, Download, Trash2, FileText, CheckCircle2, ChevronRight, X, Copy, Check } from 'lucide-react'
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
    return line.trim().startsWith('의역：') || line.trim().startsWith('직역：')
  }

  const processText = (text) => {
    setIsProcessing(true)
    const lines = text.split(/\r?\n/)
    setOriginalLines(lines)

    const newProcessedLines = []
    const newDiff = []

    let i = 0
    let processedIdxCounter = 0
    while (i < lines.length) {
      const line = lines[i]
      
      if (isTimestamp(line)) {
        newProcessedLines.push(line)
        newDiff.push({ type: 'normal', text: line, processedIdx: processedIdxCounter++ })
        
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1]
          
          if (isException(nextLine)) {
            newProcessedLines.push(nextLine)
            newDiff.push({ type: 'normal', text: nextLine, processedIdx: processedIdxCounter++ })
            i += 2 
          } else if (nextLine.trim() === '') {
            newProcessedLines.push(nextLine)
            newDiff.push({ type: 'normal', text: nextLine, processedIdx: processedIdxCounter++ })
            i += 2
          } else {
            newDiff.push({ type: 'removed', text: nextLine })
            
            if (i + 2 < lines.length) {
              const followingLine = lines[i + 2]
              newProcessedLines.push(followingLine)
              newDiff.push({ type: 'normal', text: followingLine, processedIdx: processedIdxCounter++ })
              i += 3
            } else {
              i += 2
            }
          }
        } else {
          i += 1
        }
      } else {
        newProcessedLines.push(line)
        newDiff.push({ type: 'normal', text: line, processedIdx: processedIdxCounter++ })
        i += 1
      }
    }

    setProcessedLines(newProcessedLines)
    setDiffLines(newDiff)
    setIsProcessing(false)
  }

  const handleLineEdit = (diffIdx, processedIdx, newText) => {
    // Update diffLines for UI
    const updatedDiff = [...diffLines]
    updatedDiff[diffIdx].text = newText
    setDiffLines(updatedDiff)

    // Update processedLines for export
    const updatedProcessed = [...processedLines]
    updatedProcessed[processedIdx] = newText
    setProcessedLines(updatedProcessed)
  }

  const handleLineDelete = (diffIdx, processedIdx) => {
    // Remove from processedLines
    const updatedProcessed = [...processedLines]
    updatedProcessed.splice(processedIdx, 1)
    setProcessedLines(updatedProcessed)

    // Mark as removed in diffLines and update subsequent indices
    const updatedDiff = [...diffLines]
    updatedDiff[diffIdx] = { ...updatedDiff[diffIdx], type: 'removed', processedIdx: null }
    
    // Update following lines' processedIdx
    for (let j = diffIdx + 1; j < updatedDiff.length; j++) {
      if (updatedDiff[j].processedIdx !== undefined && updatedDiff[j].processedIdx !== null) {
        updatedDiff[j].processedIdx -= 1
      }
    }
    
    setDiffLines(updatedDiff)
  }

  const handleDownload = () => {
    const content = processedLines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `processed_${file.name}`
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

  const reset = () => {
    setFile(null)
    setOriginalLines([])
    setProcessedLines([])
    setDiffLines([])
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="container">
      <header className="animate-fade-in main-header">
        <div className="logo-badge">Me</div>
        <h1>MeModify</h1>
        <p className="subtitle">Subtitle Korean Line Remover <span className="version-tag">v1.0</span></p>
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
                <span className="status-tag">Ready</span>
              </div>
              <div className="actions">
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
                <span className="stat-value">{originalLines.length} 行</span>
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
                <div key={idx} className={`diff-line ${line.type === 'removed' ? 'line-removed' : 'line-normal'}`}>
                  <span className="line-number">{idx + 1}</span>
                  {line.type === 'removed' ? (
                    <span className="line-content">
                      <Trash2 size={12} className="inline-icon" />
                      {line.text}
                    </span>
                  ) : (
                    <div className="line-content-wrapper">
                      <div 
                        className="line-content editable"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleLineEdit(idx, line.processedIdx, e.target.innerText)}
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
                        onClick={() => handleLineDelete(idx, line.processedIdx)}
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
          <p>&copy; 2026 MeModify • Local First • Privacy Focused</p>
        </div>
      </footer>
    </div>
  )
}

export default App
