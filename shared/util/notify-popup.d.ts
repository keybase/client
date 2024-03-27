declare function NotifyPopup(
  title: string,
  opts?: {body?: string; sound?: boolean},
  rateLimitSeconds?: number,
  rateLimitKey?: string,
  onClick?: () => void,
  onClose?: () => void
): void

export default NotifyPopup
