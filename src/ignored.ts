import { Disposable, disposeAll, Emitter, Event, OutputChannel, workspace } from 'coc.nvim'
import fs from 'fs'
import { now, watchFile } from './util'

export default class Ignored {
  private ignoredWords: Map<string, string[]> = new Map()
  private files: string[] = []
  private disposables: Disposable[] = []
  private readonly _onDidChange = new Emitter<void>()
  public readonly onDidChange: Event<void> = this._onDidChange.event
  constructor(
    private output: OutputChannel
  ) {
    workspace.nvim.getOption('spellfile').then(spellfile => {
      if (spellfile) {
        this.files = (spellfile as string).split(',').map(s => workspace.expand(s))
        for (let file of this.files) {
          this.watchFile(file)
        }
        this.loadFiles()
      }
    })
  }

  public loadFiles(): void {
    for (let file of this.files) {
      this.loadFile(file)
    }
  }

  private watchFile(filepath: string): void {
    this.output.appendLine(`[Info - ${now()}] Watching spellfile ${filepath}`)
    this.disposables.push(watchFile(filepath, () => {
      this.loadFile(filepath, true)
    }))
  }

  private loadFile(filepath: string, fireEvent = false): void {
    if (!fs.existsSync(filepath)) return
    fs.readFile(filepath, 'utf8', (err, data) => {
      if (err) return
      let words = data.trim().split(/\r?\n/)
      this.ignoredWords.set(filepath, words)
      this.output.appendLine(`[Info - ${now()}] Loaded ${words.length} words from spellfile ${filepath}`)
      if (fireEvent) this._onDidChange.fire()
    })
  }

  public isIgnored(word: string): boolean {
    for (let words of this.ignoredWords.values()) {
      if (words.includes(word)) return true
    }
    return false
  }

  public dispose(): void {
    disposeAll(this.disposables)
  }
}
