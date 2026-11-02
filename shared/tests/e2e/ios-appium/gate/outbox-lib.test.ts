import {cancelledOutboxIDs, delivererInterval, failedOutboxIDs, linesFrom, outboxFlushes, pendingOutboxProblem} from './outbox-lib'

const UID = '0123456789abcdef0123456789abcd19'
const A = '0000aaaa' + 'a'.repeat(56)
const B = '0000bbbb' + 'b'.repeat(56)
const at = (s: string) => `2026-11-02T01:15:58.977026Z ▶ [DEBU keybase utils.go:538] 11a9a ++Chat: | ${s} [tags:DELV=x]`
const flush = (n: number, conv: string) => at(`Deliverer: deliverLoop: flushing ${n} items from the outbox: uid: ${UID}, convID ${conv}`)
const failed = (conv: string, obid: string) =>
  at(`Deliverer: deliverLoop: failed to send msg: uid: ${UID} convID: ${conv} obid: ${obid} err: unfurler error attempts: 3`)

test("the deliverer's interval comes from its start line", () => {
  expect(delivererInterval([at(`Deliverer: deliverLoop: starting non blocking sender deliver loop: uid: ${UID} duration: 5s`)])).toBe(5_000)
  expect(delivererInterval([at(`Deliverer: deliverLoop: starting non blocking sender deliver loop: uid: ${UID} duration: 500ms`)])).toBe(500)
  expect(delivererInterval([flush(1, A)])).toBeUndefined()
})

const T0 = Date.parse('2026-11-02T01:15:58.977026Z')
// a line stamped `s` seconds after T0
const atSec = (s: number, line: string) => line.replace('2026-11-02T01:15:58.977026Z', new Date(T0 + s * 1_000).toISOString())
const pulls = {end: T0 + 16_000, interval: 5_000}

test('the pending records per conversation are what the latest pull logged', () => {
  const lines = [atSec(0, flush(2, A)), atSec(0, flush(1, B)), atSec(5, flush(3, A)), atSec(5, flush(1, B)), atSec(10, flush(3, A))]
  // B's record went between the second pull and the third: it is not counted
  expect(outboxFlushes(lines, pulls)).toEqual(new Map([[A, 3]]))
  expect(outboxFlushes([atSec(10, flush(1, A)), atSec(10.2, flush(1, B))], pulls)).toEqual(new Map([[A, 1], [B, 1]]))
  expect(outboxFlushes([at('Deliverer: deliverLoop: flushing outbox on new message: uid: x')], pulls)).toEqual(new Map())
})

test('an outbox no pull has logged for over two intervals is empty', () => {
  expect(outboxFlushes([atSec(0, flush(2, A)), atSec(5, flush(1, A))], pulls)).toEqual(new Map())
  expect(outboxFlushes([atSec(6, flush(1, A))], pulls)).toEqual(new Map([[A, 1]]))
  expect(() => outboxFlushes([flush(1, A).replace(/^\S+ /, '')], pulls)).toThrow('no time stamp')
})

test("only the named conversations' failed sends give outbox ids, once each", () => {
  const lines = [failed(A, '6c1d96a491cc0a4f'), failed(B, '33c40fc45a0b9cbc'), failed(A, '6c1d96a491cc0a4f'), failed(A, 'a145d0e4d6b54d72')]
  expect(failedOutboxIDs(lines, new Set([A]))).toEqual(['6c1d96a491cc0a4f', 'a145d0e4d6b54d72'])
  expect(failedOutboxIDs(lines, new Set())).toEqual([])
})

test("a cancel counts once the service logs it done", () => {
  expect(cancelledOutboxIDs([at('+ CancelPost(6c1d96a491cc0a4f)'), at('- Server: CancelPost(6c1d96a491cc0a4f) -> ok [time=644.708µs]'), at('- CancelPost(a145d0e4d6b54d72) -> ERROR')])).toEqual(
    new Set(['6c1d96a491cc0a4f'])
  )
})

test('a pending outbox refuses the run, naming counts only', () => {
  expect(pendingOutboxProblem(new Map(), 'iPhoneTest')).toBeUndefined()
  const p = pendingOutboxProblem(new Map([[A, 2], [B, 1]]), 'iPhoneTest')
  expect(p).toMatch(/^the Keybase app on iPhoneTest has 3 chat messages pending in its outbox \(2 conversations\)/)
  expect(p).not.toContain(A)
})

test('the lines read start at the first stamped at or after the launch', () => {
  const lines = ['2026-11-02T01:15:37.392396Z ▶ before', 'continued', '2026-11-02T01:21:05.137306Z ▶ after', 'continued', '2026-11-02T01:21:06.000000Z ▶ later']
  expect(linesFrom(lines, Date.parse('2026-11-02T01:21:00Z'))).toEqual(lines.slice(2))
  expect(linesFrom(lines, Date.parse('2026-11-02T02:00:00Z'))).toEqual([])
})
