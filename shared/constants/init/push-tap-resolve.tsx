// A tapped notification's payload is the push as the OS delivered it: APNs userInfo on iOS, the FCM
// data Bundle on Android (every value stringified). Fields may be missing, and a number is as
// likely as a string.
export type PushTapPayload = Record<string, unknown>

export const parsePushTapPayload = (json: string): PushTapPayload | undefined => {
  try {
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as PushTapPayload)
      : undefined
  } catch {
    return undefined
  }
}

// Push types a tap never opens anything for: they are acted on natively and have no screen.
const noRouteTypes = new Set(['autoreset', 'chat.failedpending', 'chat.newmessageSilent_2', 'chat.readmessage'])

// Only the prefix of a contact-joined message is read; the rest names a person.
const contactPrefix = 'Your contact'

export const pushTapField = (payload: PushTapPayload, key: string): string => {
  const value = payload[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

// The route a tapped notification opens, or undefined when the tap only opens the app. targetUid
// is '' for a route no account owns.
export const resolvePushTap = (payload: PushTapPayload): {url: string; targetUid: string} | undefined => {
  const get = (key: string) => pushTapField(payload, key)
  const type = get('type')
  switch (type) {
    case 'chat.newmessage': {
      const convID = get('convID')
      return convID ? {targetUid: get('uid'), url: `keybase://convid/${encodeURIComponent(convID)}`} : undefined
    }
    case 'follow': {
      const username = get('username')
      return username
        ? {
            targetUid: get('uid') || get('targetUID'),
            url: `keybase://profile/show/${encodeURIComponent(username)}`,
          }
        : undefined
    }
    case 'device.new':
    case 'device.revoked': {
      const uid = get('uid')
      return uid ? {targetUid: uid, url: 'keybase://devices'} : undefined
    }
    default:
      if (noRouteTypes.has(type)) return undefined
      // A contact-joined push is not account-scoped, so a tap on it must not switch accounts.
      return get('message').startsWith(contactPrefix)
        ? {targetUid: '', url: 'keybase://tabs.peopleTab'}
        : undefined
  }
}
