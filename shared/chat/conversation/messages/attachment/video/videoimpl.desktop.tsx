import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as FsGen from '../../../../../actions/fs-gen'
import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import type {Props} from './videoimpl'
import {GetIdsContext} from '../../ids-context'
import {useRedux} from './use-redux'
import {useCollapseIcon} from '../shared'

// its important we use explicit height/width so we never CLS while loading
const VideoImpl = (p: Props) => {
  const {openFullscreen} = p
  const {downloadPath, previewURL, height, width, url, videoDuration} = useRedux()

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

  const downloadOrShowIcon = downloadPath ? 'iconfont-finder' : 'iconfont-download'
  const downloadOrShowTip = downloadPath ? `Show in ${Styles.fileUIName}` : 'Download'
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const collapseIcon = useCollapseIcon(true)

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
      <Kb.Box2 direction="horizontal" alignItems="center" style={styles.actionContainer} gap="xtiny">
        <Kb.WithTooltip
          tooltip={
            <Kb.Text type="Body" style={styles.tipText}>
              {downloadOrShowTip}
            </Kb.Text>
          }
        >
          <Kb.Icon
            type={downloadOrShowIcon}
            style={styles.downloadIcon}
            color={Styles.globalColors.white_75}
            onClick={onDownloadOrShow}
          />
        </Kb.WithTooltip>
        <Kb.WithTooltip
          tooltip={
            <Kb.Text type="Body" style={styles.tipText}>
              {videoDuration}
            </Kb.Text>
          }
        >
          <Kb.Icon type="iconfont-info" style={styles.infoIcon} color={Styles.globalColors.white_75} />
        </Kb.WithTooltip>
        {collapseIcon}
      </Kb.Box2>
    </>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        alignSelf: 'flex-end',
        backgroundColor: Styles.globalColors.black_50,
        borderRadius: 2,
        overflow: 'hidden',
        padding: 1,
        paddingLeft: 4,
        paddingRight: 4,
        position: 'absolute',
        right: Styles.globalMargins.tiny,
        top: Styles.globalMargins.tiny,
      },
      downloadIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          opacity: 0.75,
          paddingTop: 2,
        },
      }),
      infoIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          opacity: 0.75,
          paddingTop: 2,
        },
      }),
      link: {
        color: Styles.globalColors.black_50,
        flexGrow: 1,
      },
      tipText: {color: Styles.globalColors.white_75},
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
