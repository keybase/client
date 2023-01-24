import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import type {Props} from './videoimpl'
import {GetIdsContext} from '../../ids-context'
import {useRedux} from './use-redux'

// its important we use explicit height/width so we never CLS while loading
const VideoImpl = (p: Props) => {
  const {openFullscreen} = p
  const {downloadPath, previewURL, height, width, url, transferState, videoDuration} = useRedux()

  const onDoubleClick = React.useCallback(() => {
    ref.current?.pause()
    openFullscreen()
  }, [openFullscreen])

  const dispatch = Container.useDispatch()
  const getIDs = React.useContext(GetIdsContext)
  const onDownloadOrShow = Container.useEvent(() => {
    if (downloadPath) {
      dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadPath}))
    } else {
      const {conversationIDKey, ordinal} = getIDs()
      dispatch(Chat2Gen.createAttachmentDownload({conversationIDKey, ordinal}))
    }
  })

  const ref = React.useRef<HTMLVideoElement | null>(null)

  const downloadOrShow = downloadPath
    ? `Show in ${Styles.fileUIName}`
    : transferState === 'downloading'
    ? 'Downloading...'
    : 'Download'

  return (
    <>
      <video
        ref={ref}
        onDoubleClick={onDoubleClick}
        height={height}
        width={width}
        poster={previewURL}
        preload="none"
        controls={true}
        playsInline={true}
        controlsList="nodownload nofullscreen noremoteplayback"
        style={styles.video as any}
      >
        <source src={url} />
      </video>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.textContainer}>
        <Kb.Text
          type="BodySmallPrimaryLink"
          onClick={onDownloadOrShow}
          style={styles.link}
          className="hover-underline"
        >
          {downloadOrShow}
        </Kb.Text>

        <Kb.Text type="BodyTinyBold">{videoDuration}</Kb.Text>
      </Kb.Box2>
    </>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      link: {color: Styles.globalColors.black_50},
      textContainer: {justifyContent: 'space-between'},
      video: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.rounded,
          maxHeight: 320,
          maxWidth: 320,
          objectFit: 'contain',
        },
      }),
    } as const)
)

export default VideoImpl
