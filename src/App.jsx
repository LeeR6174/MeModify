import { useState, useRef, useEffect, useMemo } from 'react'
import { Upload, Download, Trash2, FileText, X, Check, RotateCcw, Maximize2, Minimize2, AlertCircle, ChevronRight, Clock3, Type, Settings2 } from 'lucide-react'
import './App.css'

const isTimestamp = (line) => /\d{1,2}:\d{2}:\d{2}/.test(line) && line.includes('-->')
const isOutputLine = (line) => line.text.trim() !== '' && !isTimestamp(line.text) && !/^\d+$/.test(line.text.trim())
const getFinalLineText = (line) => line.text

function App() {
  const [file, setFile] = useState(null)
  const [originalLines, setOriginalLines] = useState([])
  const [diffLines, setDiffLines] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const containerRef = useRef(null)
  const scrollPosRef = useRef(0)
  const editableRefs = useRef([])
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [phase, setPhase] = useState(1)
  const [phase4Removed, setPhase4Removed] = useState(false)
  const [phase4Confirmed, setPhase4Confirmed] = useState(false)
  const [phase2Confirmed, setPhase2Confirmed] = useState(false)
  const [phase2BilingualLines, setPhase2BilingualLines] = useState([])
  const [correctionsApplied, setCorrectionsApplied] = useState(false)
  const [phase2Baseline, setPhase2Baseline] = useState([])
  const [fontScale, setFontScale] = useState('100%')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bilingualNameTemplate, setBilingualNameTemplate] = useState('[元のファイル名称]_日韓')
  const [japaneseNameTemplate, setJapaneseNameTemplate] = useState('[元のファイル名称]_日本語')
  
  const processedLines = useMemo(() => (
    diffLines
      .filter(line => line.type === 'normal')
      .map(getFinalLineText)
  ), [diffLines])

  const japaneseOnlyLines = useMemo(() => (
    diffLines
      .filter(line => line.type === 'normal')
      .map(line => getFinalLineText(line))
  ), [diffLines])
  const bilingualLines = useMemo(() => (
    diffLines.flatMap(line => {
      if (!isOutputLine(line)) return [line.text]
      if (line.type === 'removed') return []
      return [getFinalLineText(line)]
    })
  ), [diffLines])
  const correctionItems = useMemo(() => (
    phase < 2 || correctionsApplied ? [] :
    diffLines.reduce((items, line, index) => {
      const baselineLine = phase2Baseline[index]
      const before = baselineLine?.text ?? line.originalText ?? ''
      const after = line.text
      if (before !== after) {
        items.push({
          index,
          before,
          after,
          context: diffLines.slice(Math.max(0, index - 5), index + 6)
        })
      }

      return items
    }, [])
  ), [diffLines, phase, phase2Baseline, correctionsApplied])

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

  const isException = (line) => {
    const keywords = ['의역', '직역', '순화']
    return keywords.some(keyword => line.includes(keyword))
  }

  const hasHangul = (text) => {
    return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text)
  }

  const processText = (text) => {
    const lines = text.split(/\r?\n/)
    setOriginalLines(lines)

    const newDiff = []

    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      
      if (isTimestamp(line)) {
        newDiff.push({ type: 'normal', text: line, originalText: line, translationText: '', committedTranslationText: '', originalTranslationText: '' })
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
          newDiff.push({
            type: 'normal',
            text: contentLine,
            originalText: contentLine,
            isException: isExp,
            isKorean: hasHangul(contentLine) && !isExp,
            translationText: '',
            committedTranslationText: '',
            originalTranslationText: ''
          })
          i++
        }
      } else {
        const isExp = isException(line)
        newDiff.push({ type: 'normal', text: line, originalText: line, isException: isExp, translationText: '', committedTranslationText: '', originalTranslationText: '' })
        i++
      }
    }

    setDiffLines(newDiff)
    setPhase(1)
    setPhase2Baseline([])
    setPhase4Removed(false)
    setPhase4Confirmed(false)
    setCorrectionsApplied(false)
  }

  const handleLineEdit = (idx, newText) => {
    const updatedDiff = [...diffLines]
    updatedDiff[idx] = {
      ...updatedDiff[idx],
      text: newText,
      isKorean: hasHangul(newText) && !updatedDiff[idx].isException
    }

    setDiffLines(updatedDiff)
    setPhase4Confirmed(false)
    setPhase4Removed(false)
    setPhase2Confirmed(false)
  }

  const discardCorrection = (idx) => {
    const baselineLine = phase2Baseline[idx]
    if (!baselineLine) return
    setDiffLines(current => current.map((line, lineIndex) => (
      lineIndex === idx
        ? {
            ...line,
            text: baselineLine.text,
            isKorean: baselineLine.isKorean,
            translationText: baselineLine.translationText ?? '',
            committedTranslationText: baselineLine.committedTranslationText ?? ''
          }
        : line
    )))
    setPhase4Confirmed(false)
    setPhase2Confirmed(false)
  }

  const handleLineDelete = (idx) => {
    const updatedDiff = [...diffLines]
    updatedDiff[idx] = { ...updatedDiff[idx], type: 'removed' }
    setDiffLines(updatedDiff)
    setPhase4Confirmed(false)
    setPhase4Removed(false)
    setPhase2Confirmed(false)
  }

  const handleLineRestore = (idx) => {
    const updatedDiff = [...diffLines]
    updatedDiff[idx] = { ...updatedDiff[idx], type: 'normal' }
    setDiffLines(updatedDiff)
    setPhase4Confirmed(false)
    setPhase4Removed(false)
  }

  const completePhase1 = () => {
    setPhase2Baseline(diffLines.map(line => ({ ...line })))
    setPhase(2)
  }
  const confirmPhase2 = () => {
    setDiffLines(current => current.map(line => ({
      ...line,
      committedTranslationText: line.text
    })))
    setPhase2BilingualLines(bilingualLines)
    setPhase2Confirmed(true)
    setCorrectionsApplied(true)
    setPhase(2)
  }
  const proceedToPhase3 = () => setPhase(3)
  const removeKoreanLines = () => {
    setDiffLines(current => current.map(line => (
      line.isKorean && line.text === line.originalText
        ? { ...line, type: 'removed' }
        : line
    )))
    setPhase4Removed(true)
  }
  const confirmPhase4 = () => setPhase4Confirmed(true)

  const createDownload = (content, suffix) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    // File name: original_fixed.ext
    const originalName = file.name
    const lastDotIndex = originalName.lastIndexOf('.')
    const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName
    const ext = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : ''
    const configuredName = (suffix === 'bilingual' ? bilingualNameTemplate : japaneseNameTemplate)
      .replaceAll('[元のファイル名称]', baseName)
      .trim()
    const newName = `${configuredName || `${baseName}_${suffix}`}${ext}`
    
    a.download = newName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownload = () => createDownload(phase2BilingualLines.join('\n'), 'bilingual')
  const handleDownloadJapanese = () => createDownload(japaneseOnlyLines.join('\n'), 'japanese')

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
    setDiffLines([])
    setPhase(1)
    setPhase2Baseline([])
    setPhase4Removed(false)
    setPhase4Confirmed(false)
    setPhase2Confirmed(false)
    setPhase2BilingualLines([])
    setCorrectionsApplied(false)
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const navigatePhase = (nextPhase) => {
    if (nextPhase === 2 && phase2Baseline.length === 0) {
      setPhase2Baseline(diffLines.map(line => ({ ...line })))
    }
    setPhase(nextPhase)
    if (nextPhase !== 3) setPhase4Confirmed(false)
  }

  const handleEditorKeyDown = (event, index) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const editableIndexes = diffLines
      .map((line, lineIndex) => line.type === 'normal' ? lineIndex : -1)
      .filter(lineIndex => lineIndex !== -1)
    const currentPosition = editableIndexes.indexOf(index)
    const targetIndex = editableIndexes[currentPosition + direction]
    if (targetIndex === undefined) return
    event.preventDefault()
    editableRefs.current[targetIndex]?.focus()
  }

  const renderContextLine = (line) => {
    if (isTimestamp(line.text)) return line.text
    return line.text
  }

  const getDisplayedLineText = (line) => phase >= 3 ? getFinalLineText(line) : line.text

  return (
    <div className="container" ref={containerRef} style={{ '--app-font-size': fontScale }}>
      <header className="animate-fade-in main-header">
        <div className="logo-badge">Me</div>
        <h1>MeModify</h1>
        <p className="subtitle">字幕韓国語行削除ツール <span className="version-tag">v2.0</span></p>
        <label className="font-size-control">
          <Type size={16} />
          文字サイズ
          <select value={fontScale} onChange={(e) => setFontScale(e.target.value)}>
            <option value="90%">小</option>
            <option value="100%">標準</option>
            <option value="110%">大</option>
            <option value="120%">特大</option>
          </select>
        </label>
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
            <div className="phase-stepper" aria-label="作業フェーズ">
              {[1, 2, 3].map(step => (
                <button key={step} className={`phase-step ${phase === step ? 'active' : ''} ${phase > step ? 'completed' : ''}`} onClick={() => navigatePhase(step)}>
                  <span className="phase-number">{phase > step ? <Check size={14} /> : step}</span>
                  <span className="phase-label">Phase{step}</span>
                </button>
              ))}
            </div>
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
                <button className="btn-secondary" onClick={() => setSettingsOpen(value => !value)}>
                  <Settings2 size={18} /> 設定
                </button>
                <button className="btn-secondary" onClick={toggleFullScreen} title="フル画面モード">
                  {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  {isFullScreen ? '解除' : 'フル画面'}
                </button>
                <button className="btn-secondary" onClick={reset}>
                  <X size={18} /> 閉じる
                </button>
              </div>

              {settingsOpen && (
                <div className="settings-panel">
                  <div className="settings-title"><Settings2 size={18} /> 出力設定</div>
                  <label className="settings-field">
                    <span>日韓出力ファイル名</span>
                    <input
                      value={bilingualNameTemplate}
                      onChange={(e) => setBilingualNameTemplate(e.target.value)}
                      placeholder="[元のファイル名称]_日韓"
                    />
                  </label>
                  <label className="settings-field">
                    <span>日本語出力ファイル名</span>
                    <input
                      value={japaneseNameTemplate}
                      onChange={(e) => setJapaneseNameTemplate(e.target.value)}
                      placeholder="[元のファイル名称]_日本語"
                    />
                  </label>
                  <p className="settings-help">[元のファイル名称]（拡張子なし）が使用できます。拡張子は元ファイルから引き継ぎます。</p>
                </div>
              )}
            </div>

            <div className="phase-panel">
              <div className="phase-heading">
                <Clock3 size={18} />
                <div>
                  <strong>Phase{phase}</strong>
                  <span>{[
                    'ファイル内容の直接修正',
                    '日本語訳の添削と添削箇所の確認',
                    '韓国語の消去・確認と出力'
                  ][phase - 1]}</span>
                </div>
              </div>
              {phase > 1 && (
                <button className="btn-secondary phase-back-button" onClick={() => navigatePhase(phase - 1)}>
                  <RotateCcw size={16} /> 一つ前のPhaseへ戻る
                </button>
              )}
              {phase === 1 && (
                <div className="phase-action phase-message">
                  <span>日本語訳を記述してね♡</span>
                  <button className="btn-primary" onClick={completePhase1}>
                    修正完了・Phase2へ <ChevronRight size={18} />
                  </button>
                </div>
              )}
              {phase === 2 && (
                <div className="phase-action phase-message">
                  <span>日本語訳をメモ帳のように直接修正し、下の修正一覧で前後5行を確認してください。</span>
                  {!phase2Confirmed ? (
                    <button className="btn-primary" onClick={confirmPhase2}>
                      添削内容を確認 <Check size={18} />
                    </button>
                  ) : (
                    <div className="phase-output-actions">
                      <button className="btn-primary" onClick={handleDownload}>
                        <Download size={18} /> Phase2.1 日韓出力
                      </button>
                      <button className="btn-secondary" onClick={proceedToPhase3}>
                        Phase3へ進む <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {phase === 3 && (
                <div className="phase-action phase-message">
                  <span>{phase4Confirmed ? '韓国語の削除と確認が完了しました。日本語のみ出力できます。' : phase4Removed ? '韓国語を削除しました。削除内容を確認してください。' : '韓国語の削除を実行してください。'}</span>
                  {!phase4Removed && (
                    <button className="btn-primary" onClick={removeKoreanLines}>
                      Phase3 韓国語の削除を実行 <ChevronRight size={18} />
                    </button>
                  )}
                  {phase4Removed && !phase4Confirmed && (
                    <button className="btn-primary" onClick={confirmPhase4}>
                      削除内容の確認完了 <Check size={18} />
                    </button>
                  )}
                  {phase4Confirmed && (
                    <button className="btn-primary" onClick={handleDownloadJapanese}>
                      <Download size={18} /> Phase3.1 日本語のみ出力
                    </button>
                  )}
                </div>
              )}
            </div>

            {phase >= 2 && (
            <section className="corrections-panel">
              <div className="corrections-heading">
                <div>
                  <strong>日本語の修正一覧</strong>
                  <span>{correctionItems.length}件の修正</span>
                </div>
              </div>
              {correctionItems.length === 0 ? (
                <p className="empty-corrections">まだ日本語の修正はありません。</p>
              ) : (
                <div className="corrections-list">
                  {correctionItems.map(item => (
                    <article className="correction-card" key={item.index}>
                      <div className="correction-summary">
                        <strong>行 {item.index + 1}</strong>
                        <div>
                          {item.before !== item.after && (
                            <span><b>字幕:</b> {item.before || '（空欄）'} → {item.after || '（空欄）'}</span>
                          )}
                        </div>
                        <button
                          className="discard-correction-button"
                          onClick={() => discardCorrection(item.index)}
                        >
                          <RotateCcw size={14} /> 添削内容を破棄
                        </button>
                      </div>
                      <div className="correction-context">
                        <span className="context-label">前後5行を含む確認範囲</span>
                        {item.context.map((contextLine, contextIndex) => {
                          const actualIndex = Math.max(0, item.index - 5) + contextIndex
                          return (
                            <div className={`context-line ${actualIndex === item.index ? 'current' : ''}`} key={actualIndex}>
                              <span>{actualIndex + 1}</span>
                              <p>{renderContextLine(contextLine) || '（空行）'}</p>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            )}

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
                        {getDisplayedLineText(line)}
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
                      <div className="line-edit-group">
                        <div
                          className="line-content editable"
                          ref={(element) => { editableRefs.current[idx] = element }}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => handleLineEdit(idx, e.target.innerText)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              e.target.blur()
                            }
                            handleEditorKeyDown(e, idx)
                          }}
                        >
                          {line.text}
                        </div>
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
