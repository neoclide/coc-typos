'use strict'
import { Buffer, BufferSyncItem, CancellationTokenSource, DidChangeTextDocumentParams, Document, ExtendedHighlightItem, Mutex, OutputChannel, window, workspace } from 'coc.nvim'
import fs from 'fs'
import path from 'path'
import { inspect } from 'util'
import { getTyposBuffer, now, TyposItem } from './util'
export const NAMESPACE = 'typos'

export interface TyposConfig {
  command: string
  disabledFiletypes: string[]
  arguments: string[]
  highlightGroup: string
}

export type CheckIgnored = (word: string) => boolean

export default class TyposBuffer implements BufferSyncItem {
  private tokenSource = new CancellationTokenSource()
  private typos: ReadonlyArray<TyposItem>[] = []
  private mutex = new Mutex()
  constructor(
    private doc: Document,
    private config: TyposConfig,
    private output: OutputChannel,
    private checkIgnored: CheckIgnored
  ) {
    void this.check()
  }

  private get buffer(): Buffer {
    return this.doc.buffer
  }

  private cancel(): void {
    if (this.tokenSource) {
      this.tokenSource.cancel()
    }
  }

  public async addToKnownWordAtCursor(): Promise<void> {
    let [line, col] = await workspace.nvim.eval('[line(".")-1,col(".")-1]') as [number, number]
    let item = this.findTypo(line, col)
    if (!item) return void window.showWarningMessage(`Typo not found at cursor position`)
    let spellfile = await this.doc.buffer.getOption('spellfile') as string
    if (spellfile) spellfile = workspace.expand(spellfile)
    if (!spellfile) {
      void window.showWarningMessage(`spellfile option not exists`)
      return
    }
    if (!fs.existsSync(spellfile)) {
      let res = await window.showPrompt(`Spellfile ${spellfile} not exists, create?`)
      if (!res) return
      let folder = path.dirname(spellfile)
      fs.mkdirSync(folder, { recursive: true })
      fs.writeFileSync(spellfile, '', 'utf8')
    }
    fs.appendFileSync(spellfile, `${item.word}\n`)
  }

  public onChange(e: DidChangeTextDocumentParams): void {
    if (this.config.disabledFiletypes.includes(this.doc.filetype)) return
    if (e.contentChanges.length == 0) {
      this.addHighlights()
      return
    }
    this.check(e)
  }

  public addHighlights(): void {
    let { nvim } = workspace
    let hlGroup = this.config.highlightGroup
    let items: ExtendedHighlightItem[] = []
    for (let arr of this.typos) {
      for (let o of arr) {
        if (this.checkIgnored(o.word)) continue
        items.push({
          hlGroup,
          lnum: o.lnum,
          colEnd: o.colEnd,
          colStart: o.colStart,
          start_incl: false,
          end_incl: false
        })
      }
    }
    nvim.pauseNotification()
    this.buffer.setVar('coc_typos_count', items.length, true)
    this.buffer.updateHighlights(NAMESPACE, items)
    nvim.resumeNotification(true, true)
  }

  public findTypo(lnum: number, col: number): TyposItem | undefined {
    let arr = this.typos[lnum]
    return arr.find(o => o.colStart <= col && o.colEnd >= col)
  }

  private async check(e?: DidChangeTextDocumentParams): Promise<void> {
    let { doc } = this
    if (!doc.attached) return
    if (this.config.disabledFiletypes.includes(doc.filetype)) {
      this.warn(`${doc.uri} ignored by typos.disabledFiletypes`, doc.filetype)
      return
    }
    let textDocument = doc.textDocument
    await this.mutex.use(async () => {
      if (this.tokenSource.token.isCancellationRequested) return
      let cmd = this.config.command
      try {
        let token = this.tokenSource.token
        if (!e) {
          let len = textDocument.lineCount
          let typoList = await getTyposBuffer(cmd, this.config.arguments, textDocument.lines, token)
          this.info(`${typoList.length} typos found for ${doc.uri}.`)
          this.typos = []
          for (let i = 0; i < len; i++) {
            let arr = typoList.filter(o => o.lnum === i)
            this.typos.push(arr)
          }
        } else {
          let { range, text } = e.contentChanges[0]
          let { start, end } = range
          let sl = start.line
          let el = end.line
          let del = el - sl
          let newLines = textDocument.lines.slice(sl, sl + text.split(/\n/).length)
          let typoList = await getTyposBuffer(cmd, this.config.arguments, newLines, token)
          let arr: ReadonlyArray<TyposItem>[] = []
          for (let i = 0; i < newLines.length; i++) {
            let items = typoList.filter(o => o.lnum === i)
            items.forEach(o => o.lnum = o.lnum + sl)
            arr.push(items)
          }
          this.typos.splice(sl, del + 1, ...arr)
        }
        this.addHighlights()
      } catch (e) {
        if (e instanceof Error && e.message.includes('Cancelled')) return
        this.error(`Error on command: ${cmd}`, e)
      }
    })
  }

  public info(message: string, data?: any): void {
    this.logLevel('Info', message, data)
  }

  public warn(message: string, data?: any): void {
    this.logLevel('Warn', message, data)
  }

  public error(message: string, data?: any): void {
    this.logLevel('Error', message, data)
  }

  public logLevel(level: string, message: string, data?: any): void {
    this.output.appendLine(
      `[${level} - ${now()}] ${message}`
    )
    if (data) this.output.appendLine(this.data2String(data))
  }

  private data2String(data: unknown): string {
    if (data instanceof Error) {
      if (typeof data.stack === 'string') {
        return data.stack
      }
      return (data as Error).message
    }
    if (typeof data === 'string' || typeof data === 'boolean') {
      return data.toString()
    }
    return inspect(data, { maxArrayLength: 5 })
  }

  public dispose() {
    this.cancel()
  }
}
