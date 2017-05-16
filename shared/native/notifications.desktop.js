// @flow
/* global Notification */ // tell lint this exists
import {debounce} from 'lodash'

const rateLimit: {[key: string]: () => void} = {}
const rateLimitPayloads: {[key: string]: {title: string, opts: ?Object, onClick: ?() => void}} = {}

export function NotifyPopup(
  title: string,
  opts: ?Object,
  rateLimitSeconds: number = -1,
  rateLimitKey?: string,
  onClick: ?() => void
): void {
  if (rateLimitSeconds > 0) {
    const key = rateLimitKey || title

    // Exists? just call it to push the time back
    if (rateLimit[key]) {
      rateLimitPayloads[key] = {onClick, opts, title}
      rateLimit[key]()
      return
    } else {
      // else set it up and call it below
      rateLimit[key] = debounce(() => {
        if (rateLimitPayloads[key]) {
          const {title, opts, onClick} = rateLimitPayloads[key]
          delete rateLimitPayloads[key]
          const notification: any = new Notification(title, {...opts, silent: true})
          notification.onclick = onClick
        }
      }, rateLimitSeconds * 1000)
    }
  }

  const notification: any = new Notification(title, {...opts, silent: true})
  notification.onclick = onClick
}
