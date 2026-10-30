// What async code is bound to: the attempt it works for and, inside a test body, that body. A body
// is over once it settles, passed or thrown, or once mocha has moved on from it (a hook began while
// the body was still running: mocha timed it out). Code bound to an over body is work it left
// running (a timed-out body's own chain, or a promise a finished body never awaited); every app
// command checks its binding and refuses to run there.
// A hook binds to no body, so it is never refused.
import {AsyncLocalStorage} from 'async_hooks'

const OVER = 'attempt over: '

export const attemptOverMessage = (title: string) => `${OVER}${title}`

export const isAttemptOver = (e: unknown) => e instanceof Error && e.message.startsWith(OVER)

type Body = {title: string; over: boolean}

export type Frame<T> = {value: T; body?: Body}

// Why code bound to `frame` may not drive the app, or undefined when it may: outside any attempt,
// in a hook, or in a body mocha is still running.
export const refusal = <T>(frame: Frame<T> | undefined): string | undefined =>
  frame?.body?.over ? attemptOverMessage(frame.body.title) : undefined

export const createBinding = <T>() => {
  const store = new AsyncLocalStorage<Frame<T>>()
  // the bodies mocha started and that have not settled
  const running = new Set<Body>()
  return {
    // Runs a hook's work as `value` (or bound to nothing), never as the body whose async context the
    // hook may have inherited (a this.timeout() in a body starts mocha's timer, and so its timeout
    // callback and the hooks after it, in the body's context).
    run: <R>(value: T | undefined, fn: () => R): R => (value === undefined ? store.exit(fn) : store.run({value}, fn)),
    // Runs a test body as `value`; the body is running until fn settles, and over from then.
    runBody: async <R>(value: T, title: string, fn: () => Promise<R>): Promise<R> => {
      const body: Body = {over: false, title}
      running.add(body)
      try {
        return await store.run({body, value}, fn)
      } finally {
        body.over = true
        running.delete(body)
      }
    },
    // Marks every running body over, for a hook beginning: mocha runs one only once no body is its
    // to run, so a body still running then is one it timed out.
    endRunningBodies: (): Array<string> => {
      const titles = [...running].map(b => b.title)
      for (const b of running) b.over = true
      running.clear()
      return titles
    },
    frame: (): Frame<T> | undefined => store.getStore(),
    // Throws `attempt over: <title>` in a body that is over; nothing anywhere else.
    requireCurrent: () => {
      const why = refusal(store.getStore())
      if (why) throw new Error(why)
    },
  }
}
