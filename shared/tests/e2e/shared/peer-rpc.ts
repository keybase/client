// Minimal msgpack-RPC client for the extra `keybase --home <dir> service` processes that play
// other test accounts. engine/rpc-transport pulls in the app logger, so the framing is
// reimplemented here: a msgpack uint length followed by that many bytes of a msgpack array.
import * as net from 'net'
import {decode, encode} from '@msgpack/msgpack'

export type PeerRpc = {
  call: <T = unknown>(method: string, arg: object, timeoutMs?: number) => Promise<T>
  close: () => void
}

// Answers a service's callback (a UI prompt on this connection's session): return the result, or
// throw to answer with an error.
export type InvokeHandler = (method: string, arg: unknown) => unknown

const maxFrameSize = 64 * 1024 * 1024
const invoke = 0
const response = 1

const encodeFrame = (message: unknown[]) => {
  const payload = encode(message)
  const frame = new Uint8Array(5 + payload.length)
  frame[0] = 0xce
  new DataView(frame.buffer).setUint32(1, payload.length)
  frame.set(payload, 5)
  return frame
}

const headerLength = (b: number) => {
  if (b <= 0x7f) return 1
  if (b === 0xcc) return 2
  if (b === 0xcd) return 3
  if (b === 0xce) return 5
  return 0
}

type Pending = {
  method: string
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const describeError = (e: unknown) => {
  if (e && typeof e === 'object') {
    const {code, desc} = e as {code?: number; desc?: unknown}
    return `${typeof desc === 'string' ? desc : JSON.stringify(e)}${code === undefined ? '' : ` (code ${code})`}`
  }
  return String(e)
}

export const connectPeerRpc = async (
  socketPath: string,
  timeoutMs = 10_000,
  onInvoke?: InvokeHandler
): Promise<PeerRpc> => {
  const sock = await new Promise<net.Socket>((resolve, reject) => {
    const s = net.createConnection(socketPath)
    const timer = setTimeout(() => {
      s.destroy()
      reject(new Error(`timed out after ${timeoutMs}ms connecting to peer socket ${socketPath}`))
    }, timeoutMs)
    s.once('connect', () => {
      clearTimeout(timer)
      resolve(s)
    })
    s.once('error', err => {
      clearTimeout(timer)
      reject(new Error(`cannot connect to peer socket ${socketPath}: ${err.message}`))
    })
  })

  const pending = new Map<number, Pending>()
  let seq = 0
  let closed = false
  let buf = new Uint8Array(0)

  const failAll = (reason: string) => {
    closed = true
    for (const [id, p] of pending) {
      clearTimeout(p.timer)
      pending.delete(id)
      p.reject(new Error(`${p.method}: ${reason}`))
    }
  }

  const dispatch = (msg: unknown) => {
    if (!Array.isArray(msg)) return
    if (msg[0] === response) {
      const p = pending.get(msg[1] as number)
      if (!p) return
      pending.delete(msg[1] as number)
      clearTimeout(p.timer)
      if (msg[2] === null || msg[2] === undefined) {
        p.resolve(msg[3])
      } else {
        p.reject(new Error(`${p.method} failed: ${describeError(msg[2])}`))
      }
    } else if (msg[0] === invoke) {
      const [, id, method, params] = msg as [number, number, string, unknown[] | undefined]
      if (!onInvoke) {
        // Nothing is registered on this client; answer so the service does not wait.
        sock.write(encodeFrame([response, id, {code: 100, desc: 'No method available'}, null]))
        return
      }
      const answer = async () => {
        try {
          const result: unknown = await onInvoke(method, params?.[0])
          sock.write(encodeFrame([response, id, null, result ?? null]))
        } catch (e) {
          sock.write(encodeFrame([response, id, {code: 100, desc: e instanceof Error ? e.message : String(e)}, null]))
        }
      }
      void answer()
    }
    // notifies and cancels are ignored
  }

  sock.on('data', (chunk: Buffer) => {
    const merged = new Uint8Array(buf.length + chunk.length)
    merged.set(buf, 0)
    merged.set(chunk, buf.length)
    buf = merged
    try {
      for (;;) {
        const first = buf[0]
        if (first === undefined) return
        const hl = headerLength(first)
        if (!hl) throw new Error('bad frame header')
        if (buf.length < hl) return
        let len = hl === 1 ? first : 0
        for (let i = 1; i < hl; i++) len = len * 256 + (buf[i] ?? 0)
        if (len > maxFrameSize) throw new Error(`frame too large: ${len} bytes`)
        if (buf.length < hl + len) return
        const msg = decode(buf.slice(hl, hl + len))
        buf = buf.slice(hl + len)
        dispatch(msg)
      }
    } catch (e) {
      sock.destroy()
      failAll(`protocol error from ${socketPath}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })
  sock.on('error', err => failAll(`socket ${socketPath} error: ${err.message}`))
  sock.on('close', () => failAll(`socket ${socketPath} closed`))

  return {
    call: async <T = unknown>(method: string, arg: object, callTimeoutMs = timeoutMs) =>
      new Promise<T>((resolve, reject) => {
        if (closed) {
          reject(new Error(`${method}: connection to ${socketPath} is closed`))
          return
        }
        const id = ++seq
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`${method}: no response after ${callTimeoutMs}ms from ${socketPath}`))
        }, callTimeoutMs)
        pending.set(id, {method, reject, resolve: v => resolve(v as T), timer})
        sock.write(encodeFrame([invoke, id, method, [arg]]))
      }),
    close: () => {
      failAll('connection closed')
      sock.destroy()
    },
  }
}
