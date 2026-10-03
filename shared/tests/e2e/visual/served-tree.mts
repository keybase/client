// The dev servers serve whichever checkout they were started from. A gate run against a server
// serving a different tree would screenshot the wrong code, so check the listener's cwd.
import {execFileSync} from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const lsof = (args: string[]): string | undefined => {
  try {
    return execFileSync('lsof', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000})
  } catch (e) {
    // lsof exits 1 when it finds nothing
    if ((e as {status?: number}).status === 1) return undefined
    throw e
  }
}

export const listenerCwd = (port: number): string | undefined => {
  const pids = lsof(['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    ?.split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  const pid = pids?.[0]
  if (!pid) return undefined
  const out = lsof(['-a', '-p', pid, '-d', 'cwd', '-Fn'])
  const line = out?.split('\n').find(l => l.startsWith('n'))
  return line?.slice(1)
}

export const assertServedFrom = (port: number, expectedSharedDir: string, label: string): void => {
  const cwd = listenerCwd(port)
  if (!cwd) throw new Error(`${label}: nothing is listening on port ${port}`)
  const real = fs.realpathSync(cwd)
  const expected = fs.existsSync(expectedSharedDir) ? fs.realpathSync(expectedSharedDir) : path.resolve(expectedSharedDir)
  if (real !== expected && !real.startsWith(expected + path.sep)) {
    throw new Error(`${label}: port ${port} is served from ${real}, expected ${expected} (or under it)`)
  }
}
