/* @flow */
import moment from 'moment'

const rateLimit: {[key: string]: Object} = {}

export function NotifyPopup (title: string, opts: ?Object, rateLimitSeconds: number = -1): void {
  if (rateLimitSeconds > 0) {
    const now = moment()
    if (rateLimit[title] && now.isBefore(rateLimit[title])) {
      console.log(`Skipping notify for ${title} due to rate limit`)
      return
    }

    rateLimit[title] = now.add(rateLimitSeconds, 's')
  }

  new Notification(title, {...opts, silent: true}) //eslint-disable-line
}
