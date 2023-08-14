import type * as RPCChatTypes from '../types/rpc-chat-gen'
import type * as Types from '../types/chat2'

type NextURI = string

export declare function showShareActionSheet(options: {
  filePath?: any
  message?: any
  mimeType: string
}): Promise<{
  completed: boolean
  method: string
}>

export declare function saveAttachmentToCameraRoll(fileURL: string, mimeType: string): Promise<void>
export declare function requestLocationPermission(mode: RPCChatTypes.UIWatchPositionPerm): Promise<void>
export declare function watchPositionForMap(conversationIDKey: Types.ConversationIDKey): Promise<() => void>

export declare function initPlatformListener(): void
export declare function requestPermissionsToWrite(): Promise<void>
