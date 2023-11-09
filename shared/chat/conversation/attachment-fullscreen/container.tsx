import * as C from '../../../constants'
import * as T from '../../../constants/types'
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import Fullscreen from '.'
import {maxWidth, maxHeight} from '../messages/attachment/shared'

const blankMessage = Constants.makeMessageAttachment({})

type OwnProps = {
  conversationIDKey: T.Chat.ConversationIDKey // needed by page
  ordinal: T.Chat.Ordinal
}

const Connected = (props: OwnProps) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const currentDeviceName = C.useCurrentUserState(s => s.deviceName)
  const username = C.useCurrentUserState(s => s.username)
  const ordinals = C.useChatContext(s => s.messageOrdinals)
  const {ordinal} = props
  const data = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      return m?.type === 'attachment' ? m : blankMessage
    })
  )

  const submit = C.useRPC(T.RPCChat.localGetNextAttachmentMessageLocalRpcPromise)
  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const [message, setMessage] = React.useState<T.Chat.MessageAttachment>(data)

  const lastOrdinal = ordinals?.at(-1) ?? 0
  const {downloadPath, fileURL, id} = message
  const {previewHeight, previewURL, previewWidth, title, transferProgress} = message
  const getLastOrdinal = () => lastOrdinal
  const {height: clampedHeight, width: clampedWidth} = Constants.clampImageSize(
    previewWidth,
    previewHeight,
    maxWidth,
    maxHeight
  )

  const onSwitchAttachment = (backInTime: boolean) => {
    if (conversationIDKey !== blankMessage.conversationIDKey) {
      submit(
        [
          {
            assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
            backInTime,
            convID: T.Chat.keyToConversationID(conversationIDKey),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            messageID: id,
          },
        ],
        result => {
          if (result.message) {
            const goodMessage = Constants.uiMessageToMessage(
              conversationIDKey,
              result.message,
              username,
              getLastOrdinal,
              currentDeviceName
            )
            if (goodMessage && goodMessage.type === 'attachment') {
              setMessage(goodMessage)
            }
          }
        },
        _error => {}
      )
    }
  }

  return (
    <Fullscreen
      message={message}
      isVideo={Constants.isVideoAttachment(message)}
      onAllMedia={() => showInfoPanel(true, 'attachments')}
      onClose={() => navigateUp()}
      onDownloadAttachment={
        message.downloadPath
          ? undefined
          : () => {
              attachmentDownload(message.id)
            }
      }
      onNextAttachment={() => {
        onSwitchAttachment(false)
      }}
      onPreviousAttachment={() => {
        onSwitchAttachment(true)
      }}
      onShowInFinder={
        downloadPath ? () => openLocalPathInSystemFileManagerDesktop?.(downloadPath) : undefined
      }
      path={fileURL || previewURL}
      previewHeight={clampedHeight}
      previewWidth={clampedWidth}
      progress={transferProgress}
      progressLabel={
        downloadPath ? undefined : message.transferState === 'downloading' ? 'Downloading' : undefined
      }
      title={message.decoratedText ? message.decoratedText.stringValue() : title}
    />
  )
}

export default Connected
