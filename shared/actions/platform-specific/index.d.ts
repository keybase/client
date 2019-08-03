import * as Saga from '../../util/saga'

export declare function showShareActionSheetFromURL(options: {
  url?: any | null
  message?: any | null
  mimeType?: string | null
}): Promise<{
  completed: boolean
  method: string
}>

export declare function showShareActionSheetFromFile(fileURL: string): Promise<void>
type NextURI = string
export declare function saveAttachmentDialog(filePath: string): Promise<NextURI>
export declare function saveAttachmentToCameraRoll(fileURL: string, mimeType: string): Promise<void>
export declare function requestLocationPermission(): Promise<void>

export declare function displayNewMessageNotification(
  text: string,
  convID: string | null,
  badgeCount: number | null,
  myMsgID: number | null,
  soundName: string | null
): void

export declare function clearAllNotifications(): void

export declare function getContentTypeFromURL(
  url: string,
  cb: (arg: {
    error?: any
    statusCode?: number
    contentType?: string
    disposition?: string
  }) => Promise<string> | void
)

export declare function platformConfigSaga(): Saga.SagaGenerator<any, any>
