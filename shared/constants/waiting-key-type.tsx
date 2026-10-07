import type * as K from './waiting-keys'

type V = (typeof K)[keyof typeof K]
// Every key in waiting-keys.tsx: its fixed strings, and the template-literal types its builders return.
// The fixed strings go through a template literal so a WaitingKey value does not widen to string in an
// object or array literal.
export type WaitingKey = `${Extract<V, string>}` | ReturnType<Extract<V, (...a: never[]) => string>>
// What a call waits on, or a reader asks about: one key, or several together
export type WaitingKeys = WaitingKey | ReadonlyArray<WaitingKey>
