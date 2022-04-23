'use strict'
import { Buffer, BufferSyncItem, CancellationTokenSource, Document, ExtendedHighlightItem, OutputChannel, workspace } from 'coc.nvim'
import { inspect } from 'util'
import { getTyposBuffer, now, TyposItem } from './util'
export const NAMESPACE = 'typos'

export interface TyposConfig {
  command: string
  disabledFiletypes: string[]
  highlightGroup: string
}

export type CheckIgnored = (word: string) => boolean

export default class TyposBuffer implements BufferSyncItem {
  private tokenSource: CancellationTokenSource | undefined
  private typos: ReadonlyArray<TyposItem> | undefined
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

  public onChange(): void {
    if (this.config.disabledFiletypes.includes(this.doc.filetype)) return
    process.nextTick(() => {
      this.check()
    })
  }

  public addHighlights(): void {
    if (!this.typos) return
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
    this.buffer.setVar('coc_typos_count', items.length)
    this.buffer.updateHighlights(NAMESPACE, items)
    workspace.nvim.redrawVim()
  }

  public findTypo(lnum: number, col: number): TyposItem | undefined {
    if (!this.typos) return undefined
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
    getTyposBuffer(this.config.command, doc.textDocument.lines, token).then(typos => {
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
    this.typos = undefined
  }
}
