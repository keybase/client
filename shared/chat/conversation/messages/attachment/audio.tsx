import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as FsGen from '../../../../actions/fs-gen'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import {ConvoIDContext, OrdinalContext} from '../ids-context'
import AudioPlayer from '../../../audio/audio-player'

const missingMessage = Constants.makeMessageAttachment()
const AudioAttachment = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const dispatch = Container.useDispatch()
  // TODO not message
  const message = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })
  const progressLabel = Constants.messageAttachmentTransferStateToProgressLabel(message.transferState)
  const hasProgress = Constants.messageAttachmentHasProgress(message)
  const onShowInFinder = () => {
    message.downloadPath &&
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
  }
  const url = !message.submitState && message.fileURL.length > 0 ? `${message.fileURL}&contentforce=true` : ''
  const showInFinder = !!message.downloadPath && !Styles.isMobile
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start">
      <Kb.Box2 direction="vertical" gap="xtiny">
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <AudioPlayer big={true} duration={message.audioDuration} url={url} visAmps={message.audioAmps} />
        </Kb.Box2>
        {!showInFinder && (
          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
            <Kb.Text type="BodySmall" style={styles.progressLabelStyle}>
              {progressLabel || '\u00A0'}
            </Kb.Text>
            {hasProgress && <Kb.ProgressBar ratio={message.transferProgress} />}
          </Kb.Box2>
        )}
        {!!message.transferErrMsg && (
          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
            <Kb.Text type="BodySmall" style={styles.error}>
              Failed to download attachment, please retry
            </Kb.Text>
          </Kb.Box2>
        )}
        {showInFinder && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={onShowInFinder} style={styles.linkStyle}>
            Show in {Styles.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  error: {color: Styles.globalColors.redDark},
  linkStyle: {
    color: Styles.globalColors.black_50,
  },
  progressLabelStyle: {
    color: Styles.globalColors.black_50,
    marginRight: Styles.globalMargins.tiny,
  },
}))

export default AudioAttachment
