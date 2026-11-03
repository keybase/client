// Who listens on a TCP port, for preflight checks that refuse to run over another process's server.
import {execFileSync, spawnSync} from 'child_process'
import {parseLsof} from './release-lib.ts'

export type PortHolder = {pid: number; pgid: number; command: string}

export const holderFromPs = (pid: number, psLine: string): PortHolder => {
  const m = /^(\d+)\s+(.*)$/.exec(psLine.trim())
  return {command: (m?.[2] ?? '').slice(0, 120), pgid: Number(m?.[1] ?? -1), pid}
}

const holder = (pid: number): PortHolder => {
  try {
    return holderFromPs(pid, execFileSync('ps', ['-o', 'pgid=,command=', '-p', String(pid)], {encoding: 'utf8', timeout: 5_000}))
  } catch {
    return {command: '(exited)', pgid: -1, pid}
  }
}

export const portHolders = (port: number): {holders: Array<PortHolder>} | {error: string} => {
  const r = spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8', timeout: 10_000})
  const parsed = parseLsof({status: r.status, stderr: r.stderr, stdout: r.stdout, ...(r.error ? {error: r.error.message} : {})})
  return 'error' in parsed ? parsed : {holders: parsed.pids.map(holder)}
}
