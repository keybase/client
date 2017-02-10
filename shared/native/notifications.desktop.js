// @flow
/* global Notification */ // tell lint this exists
import moment from 'moment'

const rateLimit: {[key: string]: Object} = {}

export function NotifyPopup (title: string, opts: ?Object, rateLimitSeconds: number = -1, onClick: ?() => void): void {
  if (rateLimitSeconds > 0) {
    const now = moment()
    if (rateLimit[title] && now.isBefore(rateLimit[title])) {
      console.log(`Skipping notify for ${title} due to rate limit`)
      return
    }

    rateLimit[title] = now.add(rateLimitSeconds, 's')
  }

  const notification: any = new Notification(title, {...opts, silent: true})
  notification.onclick = onClick
}
