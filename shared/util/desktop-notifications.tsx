// The main window's side of OS notifications: the main process shows them and sends back what the
// person did, which runs the handlers kept here under the notification's id.
import KB2, {type DesktopNotificationEvent} from './electron'
import {makeUUID} from './uuid'

type Handlers = {
  onClick?: () => void
  onClose?: () => void
  onReply?: (text: string) => void
}

export type DesktopNotificationOptions = Handlers & {
  body?: string
  groupId?: string
  groupTitle?: string
  sound?: boolean
  title: string
}

// The main process holds at most this many as well; older ones can no longer report back
const maxHandlers = 100
const handlers = new Map<string, Handlers>()
const groupsShown = new Set<string>()

// Windows caps a toast's group at 64 characters; 40 hex characters of the id keep groups distinct
export const conversationNotificationGroup = (conversationIDKey: string) =>
  `chat:${conversationIDKey.slice(0, 40)}`

export const showDesktopNotification = (o: DesktopNotificationOptions) => {
  const {showNotification} = KB2.functions
  if (!showNotification) return
  const {body, groupId, groupTitle, onClick, onClose, onReply, sound, title} = o
  const id = makeUUID()
  handlers.set(id, {onClick, onClose, onReply})
  for (const key of handlers.keys()) {
    if (handlers.size <= maxHandlers) break
    handlers.delete(key)
  }
  if (groupId) groupsShown.add(groupId)
  showNotification({
    body: body ?? '',
    hasReply: !!onReply,
    id,
    silent: !sound,
    title,
    ...(groupId ? {groupId} : {}),
    ...(groupTitle ? {groupTitle} : {}),
  })
}

export const onDesktopNotificationEvent = (data: unknown) => {
  const event = data as Partial<DesktopNotificationEvent> | undefined
  const id = event?.id
  if (typeof id !== 'string') return
  const h = handlers.get(id)
  if (!h) return
  handlers.delete(id)
  switch (event?.type) {
    case 'click':
      h.onClick?.()
      break
    case 'close':
      h.onClose?.()
      break
    case 'reply': {
      const text = event.reply?.trim()
      if (text) h.onReply?.(text)
      break
    }
    default:
  }
}

// Clears what this session showed for the group from the OS notification list
export const clearDesktopNotificationGroup = (groupId: string) => {
  if (!groupsShown.delete(groupId)) return
  KB2.functions.clearNotificationGroup?.(groupId)
}
