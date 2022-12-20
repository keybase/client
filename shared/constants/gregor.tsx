export const bodyToJSON = (body?: Uint8Array) => {
  if (!body) return undefined
  try {
    return JSON.parse(Buffer.from(body).toString())
  } catch {
    return undefined
  }
}
