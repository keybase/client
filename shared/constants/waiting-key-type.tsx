import type * as K from './waiting-keys'

type V = (typeof K)[keyof typeof K]
// Every key in waiting-keys.tsx: its fixed strings, and the template-literal types its builders return
export type WaitingKey = Extract<V, string> | ReturnType<Extract<V, (...a: never[]) => string>>
// What a call waits on, or a reader asks about: one key, or several together
export type WaitingKeys = WaitingKey | ReadonlyArray<WaitingKey>
