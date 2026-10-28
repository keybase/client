import * as net from 'net'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import {decode, encode} from '@msgpack/msgpack'
import {connectPeerRpc} from './peer-rpc'

type Frame = unknown[]
type Handler = (frame: Frame, write: (buf: Uint8Array) => void, sock: net.Socket) => void

const frameBytes = (payload: unknown[]) => {
  const body = encode(payload)
  const len = encode(body.length)
  const out = new Uint8Array(len.length + body.length)
  out.set(len, 0)
  out.set(body, len.length)
  return out
}

let dir = ''
let server: net.Server | undefined
let n = 0

const startServer = async (handler: Handler) => {
  const sockPath = path.join(dir, `s${n++}.sock`)
  server = net.createServer(sock => {
    let buf = new Uint8Array(0)
    sock.on('data', (chunk: Buffer) => {
      const merged = new Uint8Array(buf.length + chunk.length)
      merged.set(buf, 0)
      merged.set(chunk, buf.length)
      buf = merged
      for (;;) {
        // peer-rpc always writes a 5 byte uint32 length header
        if (buf.length < 5) return
        const len = new DataView(buf.buffer, buf.byteOffset).getUint32(1)
        if (buf.length < 5 + len) return
        const frame = decode(buf.slice(5, 5 + len)) as Frame
        buf = buf.slice(5 + len)
        handler(frame, b => sock.write(b), sock)
      }
    })
  })
  await new Promise<void>(resolve => server!.listen(sockPath, resolve))
  return sockPath
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-rpc-'))
})
afterEach(async () => {
  await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()))
  server = undefined
  fs.rmSync(dir, {force: true, recursive: true})
})

test('call resolves with the result frame for its seqid', async () => {
  const pending: Frame[] = []
  const sockPath = await startServer((frame, write) => {
    pending.push(frame)
    if (pending.length === 2) {
      // answer out of order
      for (const f of [...pending].reverse()) {
        write(frameBytes([1, f[1], null, `result-${(f[3] as [{x: string}])[0].x}`]))
      }
    }
  })
  const rpc = await connectPeerRpc(sockPath)
  const [a, b] = await Promise.all([rpc.call('a.b', {x: 'one'}), rpc.call('c.d', {x: 'two'})])
  expect(a).toBe('result-one')
  expect(b).toBe('result-two')
  rpc.close()
})

test('call rejects with the service error', async () => {
  const sockPath = await startServer((frame, write) => {
    write(frameBytes([1, frame[1], {code: 2, desc: 'nope'}, null]))
  })
  const rpc = await connectPeerRpc(sockPath)
  await expect(rpc.call('chat.1.local.thing', {})).rejects.toThrow(/chat\.1\.local\.thing.*nope|nope.*chat\.1\.local\.thing/)
  rpc.close()
})

test('call rejects after timeoutMs naming the method', async () => {
  const sockPath = await startServer(() => {})
  const rpc = await connectPeerRpc(sockPath)
  await expect(rpc.call('slow.method', {}, 50)).rejects.toThrow(/slow\.method/)
  rpc.close()
})

test('a frame split across chunks is decoded once', async () => {
  const sockPath = await startServer((frame, write, sock) => {
    const bytes = frameBytes([1, frame[1], null, 'whole'])
    const third = Math.ceil(bytes.length / 3)
    sock.cork()
    write(bytes.subarray(0, third))
    setTimeout(() => write(bytes.subarray(third, third * 2)), 20)
    setTimeout(() => write(bytes.subarray(third * 2)), 40)
    sock.uncork()
  })
  const rpc = await connectPeerRpc(sockPath)
  await expect(rpc.call('split', {})).resolves.toBe('whole')
  rpc.close()
})

test('incoming invokes get an error frame and notifies are ignored', async () => {
  const got: Frame[] = []
  const sockPath = await startServer((frame, write) => {
    if (frame[0] === 0) {
      write(frameBytes([2, 'some.notify', [{}]]))
      write(frameBytes([0, 77, 'svc.ask', [{}]]))
      return
    }
    got.push(frame)
    write(frameBytes([1, 1, null, 'done']))
  })
  const rpc = await connectPeerRpc(sockPath)
  await expect(rpc.call('x', {})).resolves.toBe('done')
  expect(got[0]?.[0]).toBe(1)
  expect(got[0]?.[1]).toBe(77)
  expect(got[0]?.[2]).not.toBeNull()
  rpc.close()
})

test('connect rejects when the socket is missing, naming the path', async () => {
  const missing = path.join(dir, 'missing.sock')
  await expect(connectPeerRpc(missing)).rejects.toThrow(missing)
})

test('an onInvoke handler answers incoming invokes with its result or its error', async () => {
  const answers = new Map<number, Frame>()
  const sockPath = await startServer((frame, write) => {
    if (frame[0] === 0) {
      write(frameBytes([0, 50, 'ui.ask', [{q: 'yes?'}]]))
      write(frameBytes([0, 51, 'ui.other', [{}]]))
      return
    }
    answers.set(frame[1] as number, frame)
    if (answers.size === 2) write(frameBytes([1, 1, null, 'done']))
  })
  const rpc = await connectPeerRpc(sockPath, 10_000, (method, arg) => {
    if (method === 'ui.ask') return `answer to ${(arg as {q: string}).q}`
    throw new Error(`unhandled ${method}`)
  })
  try {
    await expect(rpc.call('x', {})).resolves.toBe('done')
    expect(answers.get(50)?.slice(2)).toEqual([null, 'answer to yes?'])
    expect((answers.get(51)?.[2] as {desc?: string} | undefined)?.desc).toContain('unhandled ui.other')
  } finally {
    rpc.close()
  }
})
