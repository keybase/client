import {uint8ArrayToString} from 'uint8array-extras'

export const bodyToJSON = (body?: Uint8Array) => {
  if (!body) return undefined
  try {
    return JSON.parse(uint8ArrayToString(body))
  } catch {
    return undefined
  }
}
