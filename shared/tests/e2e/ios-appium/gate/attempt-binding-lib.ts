// What async code is bound to: the attempt it works for and, inside a test body, that body. A body
// is over once it settles, passed or thrown, or once mocha has moved on from it (a hook began while
// the body was still running: mocha timed it out). Code bound to an over body is work it left
// running (a timed-out body's own chain, or a promise a finished body never awaited); every app
// command checks its binding and refuses to run there.
// A hook binds to no body, so it is never refused, except work a hook runs in a guard (runGuarded),
// which is refused once the hook stops waiting for it.
import {AsyncLocalStorage} from 'async_hooks'

const OVER = 'attempt over: '

export const attemptOverMessage = (title: string) => `${OVER}${title}`

export const isAttemptOver = (e: unknown) => e instanceof Error && e.message.startsWith(OVER)

// settled: the test's own function settled, though wdio's wrapper around it (afterTest) may still run
type Body<T> = {title: string; over: boolean; settled: boolean; value: T}
type Guard = {title: string; over: boolean}

export type Frame<T> = {value: T; body?: Body<T>; guard?: Guard}

// Why code bound to `frame` may not drive the app, or undefined when it may: outside any attempt,
// in a hook, or in a body mocha is still running.
export const refusal = <T>(frame: Frame<T> | undefined): string | undefined => {
  const over = frame?.body?.over ? frame.body : frame?.guard?.over ? frame.guard : undefined
  return over ? attemptOverMessage(over.title) : undefined
}

// `ended` is told of each body ended while its test function still ran (by endRunningBodies or
// endCurrentBody), not of one that settled.
export const createBinding = <T>(ended: (value: T) => void = () => {}) => {
  const store = new AsyncLocalStorage<Frame<T>>()
  // the bodies mocha started and that have not settled
  const running = new Set<Body<T>>()
  return {
    // Runs a hook's work as `value` (or bound to nothing), never as the body whose async context the
    // hook may have inherited (a this.timeout() in a body starts mocha's timer, and so its timeout
    // callback and the hooks after it, in the body's context).
    run: <R>(value: T | undefined, fn: () => R): R => (value === undefined ? store.exit(fn) : store.run({value}, fn)),
    // Runs a test body as `value`; the body is running until fn settles, and over from then.
    runBody: async <R>(value: T, title: string, fn: () => Promise<R>): Promise<R> => {
      const body: Body<T> = {over: false, settled: false, title, value}
      running.add(body)
      try {
        return await store.run({body, value}, fn)
      } finally {
        body.over = true
        running.delete(body)
      }
    },
    // Runs `fn` as `value` bound to no body, and refused as `title` once `end` is called: work a hook
    // gives up on (its deadline passed) cannot drive the app after the hook moves on.
    runGuarded: <R>(value: T, title: string, fn: () => Promise<R>): {done: Promise<R>; end: () => void} => {
      const guard: Guard = {over: false, title}
      return {
        done: store.run({guard, value}, fn),
        end: () => {
          guard.over = true
        },
      }
    },
    // For the test's own function, as it settles: the body ends on its own from here, so ending it
    // hands nothing over.
    settleCurrentBody: () => {
      const body = store.getStore()?.body
      if (body) body.settled = true
    },
    // Marks every running body over, for a hook beginning: mocha runs one only once no body is its
    // to run, so a body still running then is one it timed out. Returns those whose test function
    // still ran.
    endRunningBodies: (): Array<string> => {
      const bodies = [...running]
      running.clear()
      const cut = bodies.filter(b => !b.settled)
      for (const b of bodies) b.over = true
      for (const b of cut) ended(b.value)
      return cut.map(b => b.title)
    },
    // Marks the body the caller is bound to over, for work that ends it from inside its own frame (wdio's
    // afterTest, which runs inside the body's frame once the test function settled or wdio's own timer
    // gave up on it).
    endCurrentBody: () => {
      const body = store.getStore()?.body
      if (!body || body.over) return
      body.over = true
      running.delete(body)
      if (!body.settled) ended(body.value)
    },
    frame: (): Frame<T> | undefined => store.getStore(),
    // Throws `attempt over: <title>` in a body that is over; nothing anywhere else.
    requireCurrent: () => {
      const why = refusal(store.getStore())
      if (why) throw new Error(why)
    },
  }
}
