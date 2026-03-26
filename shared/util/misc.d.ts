import type {OpenDialogOptions, SaveDialogOptions} from './electron.desktop'

type NotifyPopupOpts = {body?: string; sound?: boolean}

export declare function openURL(url?: string): void
export declare function openSMS(phonenos: Array<string>, body?: string): Promise<unknown>
export declare function clearLocalLogs(): Promise<void>
export declare function pickImages(title: string): Promise<Array<string>>
export declare function pickFiles(options: OpenDialogOptions): Promise<Array<string>>
export declare function pickSave(options: SaveDialogOptions): Promise<string>
export declare function NotifyPopup(
  title: string,
  opts?: NotifyPopupOpts,
  rateLimitSeconds?: number,
  rateLimitKey?: string,
  onClick?: () => void,
  onClose?: () => void
): void
