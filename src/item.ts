'use strict'
import { Buffer, BufferSyncItem, CancellationTokenSource, window, Document, ExtendedHighlightItem, OutputChannel, workspace, DidChangeTextDocumentParams } from 'coc.nvim'
import { inspect } from 'util'
import path from 'path'
import { getTyposBuffer, now, TyposItem } from './util'
import fs from 'fs'
export const NAMESPACE = 'typos'

export interface TyposConfig {
  command: string
  disabledFiletypes: string[]
  arguments: string[]
  highlightGroup: string
}

export type CheckIgnored = (word: string) => boolean

export default class TyposBuffer implements BufferSyncItem {
  private tokenSource: CancellationTokenSource | undefined
  private typos: ReadonlyArray<TyposItem> = []
  constructor(
    private doc: Document,
    private config: TyposConfig,
    private output: OutputChannel,
    private checkIgnored: CheckIgnored
  ) {
    this.check()
  }

  private get buffer(): Buffer {
    return this.doc.buffer
  }

  private cancel(): void {
    if (this.tokenSource) {
      this.tokenSource.cancel()
      this.tokenSource = undefined
    }
  }

  public async addToKnownWordAtCursor(): Promise<void> {
    let [line, col] = await workspace.nvim.eval('[line(".")-1,col(".")-1]') as [number, number]
    let item = this.typos.find(o => o.lnum == line && o.colStart <= col && o.colEnd >= col)
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
    if (e.contentChanges.length == 0) return
    this.check()
  }

  public onTextChange(): void {
    this.cancel()
  }

  public addHighlights(): void {
    let { nvim } = workspace
    let hlGroup = this.config.highlightGroup
    let items: ExtendedHighlightItem[] = []
    for (let o of this.typos) {
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
    nvim.pauseNotification()
    this.buffer.setVar('coc_typos_count', items.length, true)
    this.buffer.updateHighlights(NAMESPACE, items)
    nvim.resumeNotification(true, true)
  }

  public findTypo(lnum: number, col: number): TyposItem | undefined {
    return this.typos.find(o => o.lnum == lnum && o.colStart <= col && o.colEnd >= col)
  }

  private check(): void {
    let { doc } = this
    if (!doc.attached) return
    if (this.config.disabledFiletypes.includes(doc.filetype)) {
      this.warn(`${doc.uri} ignored by typos.disabledFiletypes`, doc.filetype)
      return
    }
    this.cancel()
    let cmd = this.config.command
    let tokenSource = this.tokenSource = new CancellationTokenSource()
    let token = tokenSource.token
    getTyposBuffer(this.config.command, this.config.arguments, doc.textDocument.lines, token).then(typos => {
      if (token.isCancellationRequested) return
      this.typos = typos
      this.info(`${typos.length} typos found for ${doc.uri}.`)
      this.addHighlights()
    }, e => {
      if (token.isCancellationRequested) return
      this.error(`Error on command: ${cmd}`, e)
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
