import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as FsGen from '../../../actions/fs-gen'
import Fullscreen from '.'
import * as Container from '../../../util/container'
import {imgMaxWidthRaw} from '../messages/attachment/image/image-render'

const blankMessage = Constants.makeMessageAttachment({})

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey; ordinal: Types.Ordinal}>

const Connected = (props: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', Constants.noConversationIDKey)
  const inOrdinal = Container.getRouteProps(props, 'ordinal', 0)
  const [ordinal, setOrdinal] = React.useState(inOrdinal)
  const [autoPlay, setAutoPlay] = React.useState(true)
  const dispatch = Container.useDispatch()
  const m = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const lastOrdinal = Container.useSelector(
    state => [...(state.chat2.messageOrdinals.get(conversationIDKey) ?? [])].pop() ?? Types.numberToOrdinal(0)
  )
  const getLastOrdinal = () => lastOrdinal
  const username = Container.useSelector(state => state.config.username)
  const currentDeviceName = Container.useSelector(state => state.config.deviceName ?? '')
  const message = m?.type === 'attachment' ? m : blankMessage
  const {previewHeight, previewWidth, title, fileURL, previewURL, downloadPath, transferProgress} = message
  const {id} = message
  const {height: clampedHeight, width: clampedWidth} = Constants.clampImageSize(
    previewWidth,
    previewHeight,
    imgMaxWidthRaw()
  )
  const addToMessageMap = (message: Types.Message) => {
    dispatch(Chat2Gen.createAddToMessageMap({message}))
  }

  const submit = Container.useRPC(RPCChatTypes.localGetNextAttachmentMessageLocalRpcPromise)

  const onSwitchAttachment = async (backInTime: boolean) => {
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
              setAutoPlay(false)
              addToMessageMap(goodMessage)
              setOrdinal(goodMessage.ordinal)
            }
          }
        },
        _error => {
          setAutoPlay(false)
          setOrdinal(inOrdinal)
        }
      )
    }
  }

  return (
    <Fullscreen
      autoPlay={autoPlay}
      message={message}
      isVideo={Constants.isVideoAttachment(message)}
      onAllMedia={() =>
        dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'attachments'}))
      }
      onClose={() => dispatch(RouteTreeGen.createNavigateUp())}
      onDownloadAttachment={
        message.downloadPath ? undefined : () => dispatch(Chat2Gen.createAttachmentDownload({message}))
      }
      onNextAttachment={() => onSwitchAttachment(false)}
      onPreviousAttachment={() => onSwitchAttachment(true)}
      onShowInFinder={
        downloadPath
          ? () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadPath}))
          : undefined
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

Connected.navigationOptions = {
  safeAreaStyle: {
    backgroundColor: 'black', // true black
  },
}
export default Connected
