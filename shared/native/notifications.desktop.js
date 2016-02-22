/* @flow */

export function NotifyPopup (title: string, opts: ?Object): void {
  new Notification(title, {...opts, silent: true}) //eslint-disable-line
}
