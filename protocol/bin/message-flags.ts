type OnewayFlags = {
  notify?: unknown
  oneway?: unknown
}

// keybase1 and chat1 mark fire-and-forget methods with `oneway`; stellar1 uses `notify`.
export function isOneway(message: OnewayFlags): boolean {
  return Object.hasOwn(message, 'notify') || Object.hasOwn(message, 'oneway')
}

// The engine cannot auto-ack these: an empty result would hand Go a zero value it treats as an answer.
// `outParam` is the generated return type, 'null' or 'void' when the method returns nothing.
export function isMustAnswer(message: OnewayFlags, wantsCustom: boolean, outParam: string): boolean {
  return wantsCustom && !isOneway(message) && outParam !== 'null' && outParam !== 'void'
}

export function customResponseError(
  methodName: string,
  message: OnewayFlags,
  wantsCustom: boolean
): string | undefined {
  return wantsCustom && isOneway(message)
    ? `ERROR! Custom call cannot be a notify method:\n\n  ${methodName}`
    : undefined
}
