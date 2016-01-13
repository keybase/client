/* @flow */

export function NotifyPopup (title: string, opts: Object): void {
  new Notification(title, opts) //eslint-disable-line
}
