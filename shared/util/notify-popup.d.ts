declare function NotifyPopup(
  title: string,
  opts: any | null,
  rateLimitSeconds?: number,
  rateLimitKey?: string,
  onClick?: (() => void) | null,
  onClose?: (() => void) | null
): void

export default NotifyPopup
