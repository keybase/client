import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as FSConstants from '../../../constants/fs'
import * as ConfigConstants from '../../../constants/config'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Fullscreen from '.'
import * as Container from '../../../util/container'
import shallowEqual from 'shallowequal'
import {maxWidth, maxHeight} from '../messages/attachment/shared'

const blankMessage = Constants.makeMessageAttachment({})

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
}

const Connected = (props: OwnProps) => {
  const conversationIDKey = props.conversationIDKey ?? Constants.noConversationIDKey
  const inOrdinal = props.ordinal
  const [ordinal, setOrdinal] = React.useState(inOrdinal)
  const dispatch = Container.useDispatch()
  const currentDeviceName = ConfigConstants.useCurrentUserState(s => s.deviceName)
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const data = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const ordinals = state.chat2.messageOrdinals.get(conversationIDKey)
    const lastOrdinal = ordinals?.[ordinals.length - 1] ?? 0
    const message = m?.type === 'attachment' ? m : blankMessage
    const {previewHeight, previewWidth, title, fileURL, previewURL, downloadPath, transferProgress} = message
    const {id} = message
    return {
      downloadPath,
      fileURL,
      id,
      lastOrdinal,
      // TODO dont send entire message
      message,
      previewHeight,
      previewURL,
      previewWidth,
      title,
      transferProgress,
    }
  }, shallowEqual)
  const {downloadPath, fileURL, id, lastOrdinal} = data
  const {message, previewHeight, previewURL, previewWidth, title, transferProgress} = data
  const getLastOrdinal = () => lastOrdinal
  const {height: clampedHeight, width: clampedWidth} = Constants.clampImageSize(
    previewWidth,
    previewHeight,
    maxWidth,
    maxHeight
  )

  const submit = Container.useRPC(RPCChatTypes.localGetNextAttachmentMessageLocalRpcPromise)

  const onSwitchAttachment = (backInTime: boolean) => {
    if (conversationIDKey !== blankMessage.conversationIDKey) {
      submit(
        [
          {
            assetTypes: [RPCChatTypes.AssetMetadataType.image, RPCChatTypes.AssetMetadataType.video],
            backInTime,
            convID: Types.keyToConversationID(conversationIDKey),
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
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
              setOrdinal(goodMessage.ordinal)
            }
          }
        },
        _error => {
          setOrdinal(inOrdinal)
        }
      )
    }
  }

  const openLocalPathInSystemFileManagerDesktop = FSConstants.useState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  return (
    <Fullscreen
      message={message}
      isVideo={Constants.isVideoAttachment(message)}
      onAllMedia={() =>
        dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'attachments'}))
      }
      onClose={() => dispatch(RouteTreeGen.createNavigateUp())}
      onDownloadAttachment={
        message.downloadPath
          ? undefined
          : () => {
              dispatch(
                Chat2Gen.createAttachmentDownload({
                  conversationIDKey: message.conversationIDKey,
                  ordinal: message.id,
                })
              )
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
      path={fileURL ?? previewURL}
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
