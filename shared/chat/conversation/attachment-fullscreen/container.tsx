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

type OwnProps = Container.RouteProps<{message: Types.MessageAttachment}>

const Connected = (props: OwnProps) => {
  const [m, setMessage] = React.useState(Container.getRouteProps(props, 'message', blankMessage))
  const [autoPlay, setAutoPlay] = React.useState(true)
  const dispatch = Container.useDispatch()
  const state = Container.useSelector(s => s)
  const message = m?.type === 'attachment' ? m : blankMessage
  const {previewHeight, previewWidth, title, fileURL, previewURL, downloadPath, transferProgress} = message
  const {conversationIDKey, id} = message
  const {height: clampedHeight, width: clampedWidth} = Constants.clampImageSize(
    previewWidth,
    previewHeight,
    imgMaxWidthRaw()
  )

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
            const goodMessage = Constants.uiMessageToMessage(state, conversationIDKey, result.message)
            if (goodMessage && goodMessage.type === 'attachment') {
              setAutoPlay(false)
              setMessage(goodMessage)
            }
          }
        },
        _error => {
          setAutoPlay(false)
          setMessage(blankMessage)
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
      progressLabel={fileURL ? undefined : 'Loading'}
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
