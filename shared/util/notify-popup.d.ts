declare function NotifyPopup(
  title: string,
  opts?: any,
  rateLimitSeconds?: number,
  rateLimitKey?: string,
  onClick?: () => void,
  onClose?: () => void
): void

export default NotifyPopup
