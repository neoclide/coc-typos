'use strict'
import { commands, ExtensionContext, listManager, Range, HighlightItem, window, workspace, TextEdit } from 'coc.nvim'
import Ignored from './ignored'
import TyposBuffer, { NAMESPACE } from './item'
import TyposList from './list'

async function getHighlights(): Promise<HighlightItem[]> {
  let buf = await workspace.nvim.buffer
  return await buf.getHighlights(NAMESPACE)
}

function jumpTo(item: HighlightItem): void {
  workspace.nvim.call('cursor', [item.lnum + 1, item.colStart + 1], true)
}

function characterIndex(content: string, byteIndex: number): number {
  let buf = Buffer.from(content, 'utf8')
  return buf.slice(0, byteIndex).toString('utf8').length
}

export async function activate(context: ExtensionContext): Promise<void> {
  let { subscriptions } = context
  let { nvim } = workspace
  let channel = window.createOutputChannel('typos')
  let ignored = new Ignored(channel)

  subscriptions.push(channel)
  subscriptions.push(ignored)
  let bufferSync = workspace.registerBufferSync(doc => {
    let config = workspace.getConfiguration('typos', doc.uri)
    return new TyposBuffer(doc, {
      command: config.get('command', 'typos'),
      disabledFiletypes: config.get<string[]>('disabledFiletypes', []),
      highlightGroup: config.get('highlightGroup', 'SpellBad'),
    },
      channel,
      (word: string) => {
        return ignored.isIgnored(word)
      })
  })
  const refreshAll = () => {
    for (let item of bufferSync.items) {
      item.addHighlights()
    }
  }

  subscriptions.push(bufferSync)
  subscriptions.push(
    ignored.onDidChange(() => {
      refreshAll()
    })
  )

  subscriptions.push(
    workspace.registerKeymap(['n'], 'typos-next', async () => {
      let hls = await getHighlights()
      if (!hls.length) return window.showWarningMessage('No typos exists')
      let [lnum, col, wrapscan] = await nvim.eval(`[line('.')-1,col('.')-1,&wrapscan]`) as [number, number, number]
      for (let i = 0; i < hls.length; i++) {
        let item = hls[i]
        if (item.lnum > lnum || (item.lnum == lnum && item.colStart > col)) {
          jumpTo(item)
          return
        }
      }
      if (wrapscan) jumpTo(hls[0])
    }, { sync: false }),
    workspace.registerKeymap(['n'], 'typos-prev', async () => {
      let hls = await getHighlights()
      if (!hls.length) return window.showWarningMessage('No typos exists')
      let [lnum, col, wrapscan] = await nvim.eval(`[line('.')-1,col('.')-1,&wrapscan]`) as [number, number, number]
      for (let i = hls.length - 1; i >= 0; i--) {
        let item = hls[i]
        if (item.lnum < lnum || (item.lnum == lnum && item.colEnd < col)) {
          jumpTo(item)
          return
        }
      }
      if (wrapscan) jumpTo(hls[hls.length - 1])
    }, { sync: false }),
    workspace.registerKeymap(['n'], 'typos-fix', async () => {
      let bufnr = await nvim.call('bufnr', ['%'])
      let item = bufferSync.getItem(bufnr)
      if (!item) return window.showWarningMessage('Document not attached')
      let [lnum, col] = await nvim.eval(`[line('.')-1,col('.')-1,&wrapscan]`) as [number, number]
      let typo = item.findTypo(lnum, col)
      if (!typo) return window.showWarningMessage('No bad spelled word found at cursor position')
      let doc = workspace.getDocument(bufnr)
      let n = await window.showMenuPicker(typo.corrections, { title: 'Pick word' })
      if (n < 0) return
      let content = doc.getline(typo.lnum)
      let text = typo.corrections[n]
      let range = Range.create(typo.lnum, characterIndex(content, typo.colStart), typo.lnum, characterIndex(content, typo.colStart + typo.word.length))
      await doc.applyEdits([TextEdit.replace(range, text)])
    }, { sync: false }),
  )

  subscriptions.push(
    listManager.registerList(new TyposList(nvim, ignored))
  )

  subscriptions.push(
    commands.registerCommand('typos.reloadSpellfile', () => {
      ignored.loadFiles()
      refreshAll()
    })
  )
}
