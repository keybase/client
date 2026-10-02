// Who answers a custom-response call the service makes outside any session. The engine reads this;
// feature code registers here rather than importing the engine.
import type {CustomResponseIncomingCallMapType} from '@/constants/rpc/rpc-all-gen'

export type CustomResponseMethod = keyof CustomResponseIncomingCallMapType
type Answer<M extends CustomResponseMethod> = NonNullable<CustomResponseIncomingCallMapType[M]>
type AnswererOptions<M extends CustomResponseMethod> = {
  // The engine settled a response this answerer still held, with no write: the service cancelled the
  // call, or the link dropped or was reset. Gets the response the answerer was handed.
  onCancelled?: (response: Parameters<Answer<M>>[1]) => void
}
export type IncomingAnswerer = {
  answer: (params: unknown, response: unknown) => void
  onCancelled?: (response: unknown) => void
}

declare global {
  var __hmr_incomingAnswerers: Map<string, IncomingAnswerer> | undefined
}

// Shared across HMR: an engine kept alive by HMR still reads the map its own module loaded
const answerers: Map<string, IncomingAnswerer> = __DEV__
  ? (globalThis.__hmr_incomingAnswerers ??= new Map())
  : new Map()

// Returns the unregister. One answerer per method, so two owners can never both answer a call.
export const registerIncomingAnswerer = <M extends CustomResponseMethod>(
  method: M,
  answer: Answer<M>,
  options?: AnswererOptions<M>
): (() => void) => {
  if (answerers.has(method)) {
    throw new Error(`An incoming answerer is already registered for ${method}`)
  }
  const entry: IncomingAnswerer = {
    answer: answer as IncomingAnswerer['answer'],
    onCancelled: options?.onCancelled as IncomingAnswerer['onCancelled'],
  }
  answerers.set(method, entry)
  return () => {
    if (answerers.get(method) === entry) {
      answerers.delete(method)
    }
  }
}

export const getIncomingAnswerer = (method: string): IncomingAnswerer | undefined => answerers.get(method)
