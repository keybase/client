// @flow

export function NotifyPopup(
  title: string,
  opts: Object,
  rateLimitSeconds: number = -1,
  rateLimitKey?: string
): void {
  console.log('NotifyPopup: ', title, opts)
}
