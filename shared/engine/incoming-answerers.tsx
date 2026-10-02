// Who answers a custom-response call the service makes outside any session. The engine reads this;
// feature code registers here rather than importing the engine.
import type {CustomResponseIncomingCallMapType} from '@/constants/rpc/rpc-all-gen'

export type CustomResponseMethod = keyof CustomResponseIncomingCallMapType
type AnyAnswerer = (params: unknown, response: unknown) => void

declare global {
  var __hmr_incomingAnswerers: Map<string, AnyAnswerer> | undefined
}

// Shared across HMR: an engine kept alive by HMR still reads the map its own module loaded
const answerers: Map<string, AnyAnswerer> = __DEV__
  ? (globalThis.__hmr_incomingAnswerers ??= new Map())
  : new Map()

// Returns the unregister. One answerer per method, so two owners can never both answer a call.
export const registerIncomingAnswerer = <M extends CustomResponseMethod>(
  method: M,
  answer: NonNullable<CustomResponseIncomingCallMapType[M]>
): (() => void) => {
  if (answerers.has(method)) {
    throw new Error(`An incoming answerer is already registered for ${method}`)
  }
  const untyped = answer as AnyAnswerer
  answerers.set(method, untyped)
  return () => {
    if (answerers.get(method) === untyped) {
      answerers.delete(method)
    }
  }
}

export const getIncomingAnswerer = (method: string): AnyAnswerer | undefined => answerers.get(method)
