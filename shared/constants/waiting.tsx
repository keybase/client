import type {RPCError} from '../util/errors'
import type * as Container from '../util/container'

export const anyWaiting = (state: Container.TypedState, ...keys: Array<string>) => {
  return !!keys.some(k => (state.waiting.counts.get(k) || 0) > 0)
}

export const anyErrors = (
  state: Container.TypedState,
  keys: string | Array<string>
): RPCError | undefined => {
  if (!Array.isArray(keys)) {
    return state.waiting.errors.get(keys) || undefined
  }

  const errorKey = keys.find(k => state.waiting.errors.get(k))
  return (errorKey && state.waiting.errors.get(errorKey)) || undefined
}
