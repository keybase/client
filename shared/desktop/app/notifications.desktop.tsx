// OS notifications for the main window. Clicks, replies and closes go back to the main window on the
// KBnotification channel, by the id the renderer gave the notification.
import * as Electron from 'electron'
import {isDarwin, isWindows} from '@/constants/platform'
import type {DesktopNotificationEvent} from '@/util/electron'
import {getMainWindow} from './main-window-ref.desktop'
import {isNotificationGroupID, parseNotificationRequest} from './bridge-rules.desktop'

// Events only reach a notification while something holds it. macOS doesn't always report a close, so
// keep the newest ones and let the oldest go.
const maxHeld = 100
const held = new Map<string, {groupId?: string; notification: Electron.Notification}>()

const send = (event: DesktopNotificationEvent) => {
  getMainWindow()?.webContents.send('KBnotification', event)
}

const focusMainWindow = () => {
  const win = getMainWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export const showNotification = (request: unknown) => {
  const n = parseNotificationRequest(request)
  if (!n || !Electron.Notification.isSupported()) return
  const {id, groupId} = n
  // inline reply, ids and groups are macOS and Windows only
  const canReply = n.hasReply && (isDarwin || isWindows)
  const notification = new Electron.Notification({
    body: n.body,
    silent: n.silent,
    title: n.title,
    ...(isDarwin || isWindows ? {id} : {}),
    ...((isDarwin || isWindows) && groupId ? {groupId} : {}),
    ...(isWindows && groupId && n.groupTitle ? {groupTitle: n.groupTitle} : {}),
    ...(canReply ? {hasReply: true, replyPlaceholder: 'Reply'} : {}),
  })
  const forget = () => {
    if (held.get(id)?.notification === notification) held.delete(id)
  }
  notification.on('click', () => {
    focusMainWindow()
    send({id, type: 'click'})
    forget()
  })
  notification.on('reply', details => {
    send({id, reply: details.reply, type: 'reply'})
    forget()
  })
  notification.on('close', () => {
    send({id, type: 'close'})
    forget()
  })
  held.delete(id)
  held.set(id, {groupId, notification})
  for (const key of held.keys()) {
    if (held.size <= maxHeld) break
    held.delete(key)
  }
  notification.show()
}

// Takes a conversation's notifications out of Notification Center (macOS) or the Action Center
// (Windows); on Linux the ones still showing are closed
export const clearNotificationGroup = (groupId: unknown) => {
  if (!isNotificationGroupID(groupId)) return
  if (isDarwin) {
    Electron.Notification.removeGroup(groupId)
  }
  for (const [id, h] of [...held]) {
    if (h.groupId !== groupId) continue
    held.delete(id)
    h.notification.close()
  }
}
