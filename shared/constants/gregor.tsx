const decoder = new TextDecoder()
export const bodyToJSON = (body?: Uint8Array) => {
  if (!body) return undefined
  try {
    return JSON.parse(decoder.decode(body))
  } catch {
    return undefined
  }
}
