type OnewayFlags = {
  notify?: unknown
  oneway?: unknown
}

// keybase1 and chat1 mark fire-and-forget methods with `oneway`; stellar1 uses `notify`.
export function isOneway(message: OnewayFlags): boolean {
  return Object.hasOwn(message, 'notify') || Object.hasOwn(message, 'oneway')
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
