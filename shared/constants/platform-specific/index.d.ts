import type * as T from '../types'

type NextURI = string

export declare function showShareActionSheet(options: {
  filePath?: string
  message?: string
  mimeType: string
}): Promise<{
  completed: boolean
  method: string
}>

export declare function saveAttachmentToCameraRoll(fileURL: string, mimeType: string): Promise<void>
export declare function requestLocationPermission(mode: T.RPCChat.UIWatchPositionPerm): Promise<void>
export declare function watchPositionForMap(conversationIDKey: T.Chat.ConversationIDKey): Promise<() => void>

export declare function initPlatformListener(): void
export declare function requestPermissionsToWrite(): Promise<void>
export declare const fsCacheDir: string
