'use strict'
import { spawn } from 'child_process'
import { CancellationToken, Disposable, window } from 'coc.nvim'
import debounce from 'debounce'
import fs from 'fs'
import readline from 'readline'

export interface TyposItem {
  type: string
  word: string
  /**
   * all 0 indexed
   */
  lnum: number
  colStart: number
  colEnd: number
  corrections: string[]
}

export function spawnCommand(cmd: string, args: string[], lines: ReadonlyArray<string>, token: CancellationToken, onLine: (line: string) => void): Promise<void> {
  const cp = spawn(cmd, args, { cwd: process.cwd() })
  return new Promise((resolve, reject) => {
    let disposable = token.onCancellationRequested(() => {
      disposable.dispose()
      reject(new Error('Cancelled'))
      cp.kill()
    })
    cp.on('error', (err) => {
      reject(err)
    })
    const rl = readline.createInterface({
      input: cp.stdout,
      terminal: false,
    })
    rl.on('line', line => {
      onLine(line)
    })
    rl.on('close', () => {
      resolve()
    })
    cp.on('exit', code => {
      if (code != 0) {
        reject(new Error(`process exit with ${code}`))
      }
    })
    cp.stdin.on('error', err => {
      if (err['code'] !== 'EPIPE') {
        reject(err)
      }
    })
    cp.stdin.write(lines.join('\n') + '\n')
    cp.stdin.end()
    cp.stderr.on('data', data => {
      window.showErrorMessage(`"${cmd} ${args.join(' ')}" error: ${data.toString()}`)
    })
  })
}

export function parseLine(line: string): TyposItem | undefined {
  if (line.length == 0) return undefined
  try {
    let obj = JSON.parse(line)
    return {
      type: obj.type,
      word: obj.typo,
      lnum: obj.line_num - 1,
      colStart: obj.byte_offset,
      colEnd: obj.byte_offset + Buffer.byteLength(obj.typo),
      corrections: obj.corrections
    }
  } catch (e) {
    console.log(`Parse error: ${(e as Error).message}`)
    return undefined
  }
}

export function getTyposBuffer(cmd: string, args: string[], lines: ReadonlyArray<string>, token: CancellationToken): Promise<ReadonlyArray<TyposItem>> {
  let res: TyposItem[] = []
  return new Promise((resolve, reject) => {
    spawnCommand(cmd, [...args, '--format=json', '-'], lines, token, line => {
      let item = parseLine(line)
      if (item) res.push(item)
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
