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

const callTypes: ReadonlyArray<string> = ['promise', 'incoming', 'engineListener', 'custom']
// Registering UIs and notification channels is per connection, not per account
const processWidePrefixes: ReadonlyArray<string> = ['keybase.1.delegateUiCtl.', 'keybase.1.notifyCtl.']

// What is wrong with one enabled-calls.json entry. `survivesAccountChange` marks a call the GUI
// makes whose answer outlives the logged-in account, so it goes only on a call the GUI makes.
export function enabledCallErrors(method: string, flags: Record<string, unknown>): Array<string> {
  const errors: Array<string> = []
  for (const key of Object.keys(flags)) {
    if (!callTypes.includes(key) && key !== 'survivesAccountChange') {
      errors.push(`ERROR! Invalid enabled call?\n\n  ${method} ${key}`)
    }
  }
  const outgoing = !!flags['promise'] || !!flags['engineListener']
  if (flags['survivesAccountChange'] && !outgoing) {
    errors.push(`ERROR! survivesAccountChange needs promise or engineListener:\n\n  ${method}`)
  }
  if (outgoing && !flags['survivesAccountChange'] && processWidePrefixes.some(p => method.startsWith(p))) {
    errors.push(`ERROR! ${method} is per connection, not per account: mark it survivesAccountChange`)
  }
  return errors
}
