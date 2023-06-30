import logger from '../logger'
import debounce from 'lodash/debounce'

const rateLimit: {[K in string]: () => void} = {}
const rateLimitPayloads: {
  [K in string]: {
    title: string
    opts?: Object
    onClick?: () => void
  }
} = {}

function NotifyPopup(
  title: string,
  opts: any,
  rateLimitSeconds: number = -1,
  rateLimitKey?: string,
  onClick?: () => void,
  onClose?: () => void
): void {
  const sound = opts && opts.sound
  if (rateLimitSeconds > 0) {
    const key = rateLimitKey || title

    // Exists? just call it to push the time back
    if (rateLimit[key]) {
      rateLimitPayloads[key] = {onClick: onClick, opts, title}
      rateLimit[key]!()
      return
    } else {
      // else set it up and call it below
      rateLimit[key] = debounce(() => {
        if (rateLimitPayloads[key]) {
          const {title, opts, onClick} = rateLimitPayloads[key] ?? {}
          delete rateLimitPayloads[key]
          const notification = new Notification(title ?? '', {...opts, silent: !sound})
          notification.onclick = onClick ?? null
          notification.onclose = onClose ?? null
        }
      }, rateLimitSeconds * 1000)
    }
  }

  logger.info('NotifyPopup: creating notification')
  const notification = new Notification(title, {...opts, silent: !sound})
  notification.onclick = onClick ?? null
  notification.onclose = onClose ?? null
}

export default NotifyPopup
