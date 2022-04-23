'use strict'
import { ChildProcess, spawn } from 'child_process'
import { BasicList, ListContext, ansiparse, ListTask, Location, Neovim, Range, Uri, workspace } from 'coc.nvim'
import { EventEmitter } from 'events'
import path from 'path'
import readline from 'readline'
import Ignored from './ignored'

export type CheckIgnored = (word: string) => boolean

class Task extends EventEmitter implements ListTask {
  private process: ChildProcess | undefined

  public start(cmd: string, cwd: string, args: string[], checkIgnored: CheckIgnored): void {
    let process = this.process = spawn(cmd, ['.', '--format', 'brief', '--color', 'always'].concat(args), { cwd })
    process.on('error', e => {
      this.emit('error', e.message)
    })
    const rl = readline.createInterface(process.stdout)
    process.stderr.on('data', chunk => {
      console.error(chunk.toString('utf8')) // tslint:disable-line
    })
    rl.on('line', line => {
      if (line.length == 0) return
      let items = ansiparse(line)
      let text = items.reduce((p, c) => {
        return p + c.text
      }, '')
      let parts = text.split(':')
      let ms = text.match(/`(.*?)`/)
      let word = ms ? ms[1] : ''
      if (checkIgnored(word)) return
      let lnum = parseInt(parts[1], 10)
      let byteIndex = parseInt(parts[2], 10)
      let fullpath = path.join(cwd, parts[0])
      let location = Location.create(Uri.file(fullpath).toString(), Range.create(lnum - 1, byteIndex, lnum - 1, byteIndex + word.length))
      this.emit('data', {
        label: line,
        sortText: parts[0],
        location
      })
    })
    rl.on('close', () => {
      this.emit('end')
    })
  }

  public dispose(): void {
    let { process } = this
    if (process && !process.killed) {
      process.kill()
    }
  }
}

export default class TyposList extends BasicList {
  public readonly name = 'typos'
  public readonly defaultAction = 'open'
  public description = 'Check typos for project files '
  public options = [{
    name: '-W, -workspace',
    description: 'Use current workspace folder instead of cwd.'
  }]

  constructor(nvim: Neovim, private ignored: Ignored) {
    super(nvim)
    this.addLocationActions()
  }

  public async loadItems(context: ListContext): Promise<ListTask> {
    let config = workspace.getConfiguration('typos')
    let cmd = config.get('command', 'typos')
    let args = config.get<string[]>('listTyposArguments', [])
    let options = this.parseArguments(context.args)
    let cwd = options.workspace ? workspace.root : workspace.cwd
    let task = new Task()
    task.start(cmd, cwd, args, word => {
      return this.ignored.isIgnored(word)
    })
    return task
  }
}
