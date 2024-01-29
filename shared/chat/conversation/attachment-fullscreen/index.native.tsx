import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import {useMessagePopup} from '../messages/message-popup'
import {Video, ResizeMode} from 'expo-av'
import logger from '@/logger'
import {ShowToastAfterSaving} from '../messages/attachment/shared'
import type {Props} from '.'
import {useData} from './hooks'

const Fullscreen = (p: Props) => {
  const {showHeader = true} = p
  const data = useData(p.ordinal)
  const {isVideo, onClose, message, path, previewHeight, onAllMedia} = data
  const {onNextAttachment, onPreviousAttachment} = data
  const [loaded, setLoaded] = React.useState(false)
  const {ordinal} = message

  const {showPopup, popup} = useMessagePopup({ordinal})

  const onSwipe = React.useCallback(
    (left: boolean) => {
      if (left) {
        onNextAttachment()
      } else {
        onPreviousAttachment()
      }
    },
    [onNextAttachment, onPreviousAttachment]
  )

  let content: React.ReactNode = null
  let spinner: React.ReactNode = null

  if (path) {
    if (isVideo) {
      content = (
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          style={styles.videoWrapper}
        >
          <Video
            source={{uri: `${path}&contentforce=true`}}
            onError={e => {
              logger.error(`Error loading vid: ${JSON.stringify(e)}`)
            }}
            onLoad={() => setLoaded(true)}
            shouldPlay={false}
            useNativeControls={true}
            style={{
              height: Math.max(previewHeight, 100),
              width: '100%',
            }}
            resizeMode={ResizeMode.CONTAIN}
          />
        </Kb.Box2>
      )
    } else {
      content = <Kb.ZoomableImage src={path} style={styles.zoomableBox} onSwipe={onSwipe} />
    }
  }
  if (!loaded && isVideo) {
    spinner = (
      <Kb.Box2
        direction="vertical"
        style={styles.progressWrapper}
        centerChildren={true}
        fullHeight={true}
        fullWidth={true}
      >
        <Kb.ProgressIndicator style={styles.progressIndicator} white={true} />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={{backgroundColor: Styles.globalColors.blackOrBlack}}
      fullWidth={true}
      fullHeight={true}
    >
      {spinner}
      <ShowToastAfterSaving transferState={message.transferState} />
      {showHeader ? (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerWrapper}>
          <Kb.Text type="Body" onClick={onClose} style={styles.close}>
            Close
          </Kb.Text>
          <Kb.Text type="Body" onClick={onAllMedia} style={styles.allMedia}>
            All media
          </Kb.Text>
        </Kb.Box2>
      ) : null}
      <Kb.BoxGrow>{content}</Kb.BoxGrow>
      <Kb.Button icon="iconfont-ellipsis" style={styles.headerFooter} onClick={showPopup} />
      {popup}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      allMedia: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        color: Styles.globalColors.blueDark,
        marginLeft: 'auto',
        padding: Styles.globalMargins.small,
      },
      assetWrapper: {
        ...Styles.globalStyles.flexBoxCenter,
        flex: 1,
      },
      close: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        color: Styles.globalColors.blueDark,
        padding: Styles.globalMargins.small,
      },
      fastImage: {
        height: Styles.dimensionHeight,
        width: Styles.dimensionWidth,
      },
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blackOrBlack,
        bottom: Styles.globalMargins.small,
        flexShrink: 0,
        height: 34,
        left: Styles.globalMargins.small,
        position: 'absolute',
        width: 34,
        zIndex: 3,
      },
      headerWrapper: {backgroundColor: Styles.globalColors.blackOrBlack},
      progressIndicator: {
        width: 48,
      },
      progressWrapper: {
        position: 'absolute',
      },
      safeAreaTop: {
        ...Styles.globalStyles.flexBoxColumn,
        ...Styles.globalStyles.fillAbsolute,
        backgroundColor: Styles.globalColors.blackOrBlack,
      },
      videoWrapper: {
        position: 'relative',
      },
      zoomableBox: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        height: '100%',
        position: 'relative',
        width: '100%',
      },
      zoomableBoxContainer: {
        flex: 1,
        position: 'relative',
      },
    }) as const
)

export default Fullscreen
