import { spawn } from 'child_process'
import { Disposable, window } from 'coc.nvim'
import debounce from 'debounce'
import readline from 'readline'
import fs from 'fs'

export interface TyposItem {
  type: string
  word: string
  lnum: number
  colStart: number
  colEnd: number
  corrections: string[]
}

export function spawnCommand(cmd: string, args: string[], stdin: string, onLine: (line: string) => void): Promise<void> {
  const cp = spawn(cmd, args, { cwd: process.cwd(), serialization: 'advanced' })
  return new Promise((resolve, reject) => {
    cp.on('error', (err) => {
      reject(err)
    })
    const rl = readline.createInterface(cp.stdout)
    rl.on('line', line => {
      onLine(line)
    })
    rl.on('close', () => {
      resolve()
    })
    cp.stdin.write(stdin)
    cp.stdin.end()
    cp.stderr.on('data', data => {
      window.showErrorMessage(`"${cmd} ${args.join(' ')}" error: ${data.toString()}`)
    })
  })
}

export function getTypos(cmd: string, content: string): Promise<ReadonlyArray<TyposItem>> {
  let res: TyposItem[] = []
  return new Promise((resolve, reject) => {
    spawnCommand(cmd, ['--format=json', '-'], content, line => {
      if (line.length) {
        try {
          let obj = JSON.parse(line)
          res.push({
            type: obj.type,
            word: obj.typo,
            lnum: obj.line_num - 1,
            colStart: obj.byte_offset,
            colEnd: obj.byte_offset + Buffer.byteLength(obj.typo),
            corrections: obj.corrections
          })
        } catch (e) {
          // ignored
        }
      }
    }).then(() => {
      res.sort((a, b) => {
        if (a.lnum != b.lnum) return a.lnum - b.lnum
        return a.colStart - b.colStart
      })
      resolve(res)
    }, reject)
  })
}


function padLeft(s: string, n: number, pad = ' ') {
  return pad.repeat(Math.max(0, n - s.length)) + s
}

export function now(): string {
  const now = new Date()
  return padLeft(now.getUTCHours() + '', 2, '0')
    + ':' + padLeft(now.getMinutes() + '', 2, '0')
    + ':' + padLeft(now.getUTCSeconds() + '', 2, '0') + '.' + now.getMilliseconds()
}

export function watchFile(filepath: string, onChange: () => void): Disposable {
  let callback = debounce(onChange, 100)
  try {
    let watcher = fs.watch(filepath, {
      persistent: true,
      recursive: false,
      encoding: 'utf8'
    }, () => {
      callback()
    })
    return Disposable.create(() => {
      callback.clear()
      watcher.close()
    })
  } catch (e) {
    return Disposable.create(() => {
      callback.clear()
    })
  }
}
