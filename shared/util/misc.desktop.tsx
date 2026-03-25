import logger from '@/logger'
import debounce from 'lodash/debounce'
import KB2, {type OpenDialogOptions, type SaveDialogOptions} from './electron.desktop'

const {openURL: openURLImpl, showOpenDialog, showSaveDialog} = KB2.functions

type NotifyPopupOpts = {body?: string; sound?: boolean}

const rateLimit: {[K in string]: () => void} = {}
const rateLimitPayloads: {
  [K in string]:
    | {
        title: string
        opts?: NotifyPopupOpts
        onClick?: () => void
      }
    | undefined
} = {}

export const openURL = (url?: string) => {
  if (!url) {
    console.log('Skipping null url click')
    return
  }
  return openURLImpl?.(url)
}

export const openSMS = async (): Promise<unknown> => {
  console.warn('Attempted to open SMS on desktop')
  return Promise.reject(new Error("Can't open SMS on desktop"))
}

export const clearLocalLogs = async (): Promise<void> => {
  // noop on desktop
}

export const pickImages = async (title: string) => {
  if (!showOpenDialog) return []
  const filePaths = await showOpenDialog({
    allowFiles: true,
    allowMultiselect: true,
    filters: [{extensions: ['jpg', 'png', 'gif'], name: 'Images'}],
    title,
  })
  return filePaths
}

export const pickFiles = async (options: OpenDialogOptions) => {
  if (!showOpenDialog) return []
  const filePaths = await showOpenDialog(options)
  return filePaths
}

export const pickSave = async (options: SaveDialogOptions): Promise<string> => {
  if (!showSaveDialog) return [] as unknown as string
  const res = await showSaveDialog(options)
  return res
}

export function NotifyPopup(
  title: string,
  opts?: NotifyPopupOpts,
  rateLimitSeconds: number = -1,
  rateLimitKey?: string,
  onClick?: () => void,
  onClose?: () => void
): void {
  const sound = opts?.sound
  if (rateLimitSeconds > 0) {
    const key = rateLimitKey || title

    if (rateLimit[key]) {
      rateLimitPayloads[key] = {onClick, opts, title}
      rateLimit[key]()
      return
    }

    rateLimit[key] = debounce(() => {
      if (rateLimitPayloads[key]) {
        const {title, opts, onClick} = rateLimitPayloads[key]
        rateLimitPayloads[key] = undefined
        const notification = new Notification(title, {...opts, silent: !sound})
        notification.onclick = onClick ?? null
        notification.onclose = onClose ?? null
      }
    }, rateLimitSeconds * 1_000)
  }

  logger.info('NotifyPopup: creating notification')
  const notification = new Notification(title, {...opts, silent: !sound})
  notification.onclick = onClick ?? null
  notification.onclose = onClose ?? null
}
