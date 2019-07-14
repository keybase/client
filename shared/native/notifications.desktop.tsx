import {debounce} from 'lodash-es'
import logger from '../logger'

const rateLimit: {[K in string]: () => void} = {}
const rateLimitPayloads: {
  [K in string]: {
    title: string
    opts: Object | null
    onClick: (() => void) | null
  }
} = {}

export function NotifyPopup(
  title: string,
  opts: any | null,
  rateLimitSeconds: number = -1,
  rateLimitKey?: string,
  onClick?: (() => void) | null,
  onClose?: (() => void) | null
): void {
  const sound = opts && opts.sound
  if (rateLimitSeconds > 0) {
    const key = rateLimitKey || title

    // Exists? just call it to push the time back
    if (rateLimit[key]) {
      rateLimitPayloads[key] = {onClick: onClick || null, opts, title}
      rateLimit[key]()
      return
    } else {
      // else set it up and call it below
      rateLimit[key] = debounce(() => {
        if (rateLimitPayloads[key]) {
          const {title, opts, onClick} = rateLimitPayloads[key]
          delete rateLimitPayloads[key]
          const notification = new Notification(title, {...opts, silent: !sound})
          notification.onclick = onClick || null
          notification.onclose = onClose || null
        }
      }, rateLimitSeconds * 1000)
    }
  }

  logger.info('NotifyPopup: creating notification')
  const notification = new Notification(title, {...opts, silent: !sound})
  notification.onclick = onClick || null
  notification.onclose = onClose || null
}
