import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import {useMessagePopup} from '../messages/message-popup'
import {Video, ResizeMode} from 'expo-av'
import logger from '@/logger'
import {ShowToastAfterSaving} from '../messages/attachment/shared'
import type {Props} from '.'
import {useData, usePreviewFallback} from './hooks'
import {Animated} from 'react-native'
import {Image} from 'expo-image'

const Fullscreen = (p: Props) => {
  const {showHeader: _showHeader = true} = p
  const data = useData(p.ordinal)
  const {isVideo, onClose, message, path, previewHeight, onAllMedia, previewPath} = data
  const {onNextAttachment, onPreviousAttachment} = data
  const [loaded, setLoaded] = React.useState(false)
  const {ordinal} = message
  const [showHeader, setShowHeader] = React.useState(_showHeader)
  const toggleHeader = React.useCallback(() => {
    setShowHeader(s => !s)
  }, [])

  const preload = React.useCallback((path: string, onLoad: () => void, onError: () => void) => {
    const f = async () => {
      try {
        await Image.prefetch(path)
        onLoad()
      } catch {
        onError()
      }
    }
    f()
      .then(() => {})
      .catch(() => {})
  }, [])

  const {onLoaded, onLoadError, imgSrc} = usePreviewFallback(path, previewPath, isVideo, preload)
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
      content = (
        <Kb.ZoomableImage
          src={imgSrc}
          style={styles.zoomableBox}
          onSwipe={onSwipe}
          onTap={toggleHeader}
          onError={onLoadError}
          onLoaded={onLoaded}
        />
      )
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

  const fadeAnim = React.useRef(new Animated.Value(1)).current
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      duration: 240,
      toValue: showHeader ? 1 : 0,
      useNativeDriver: true,
    }).start()
  }, [showHeader, fadeAnim])

  return (
    <Kb.Box2
      direction="vertical"
      style={{backgroundColor: Styles.globalColors.blackOrBlack, position: 'relative'}}
      fullWidth={true}
      fullHeight={true}
    >
      {spinner}
      <ShowToastAfterSaving transferState={message.transferState} />
      <Kb.BoxGrow>{content}</Kb.BoxGrow>
      <Animated.View style={[styles.animated, {opacity: fadeAnim}]}>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.headerWrapper}>
          <Kb.Text type="Body" onClick={onClose} style={styles.close}>
            Close
          </Kb.Text>
          <Kb.Text type="Body" onClick={onAllMedia} style={styles.allMedia}>
            All media
          </Kb.Text>
        </Kb.Box2>
      </Animated.View>
      <Kb.Button icon="iconfont-ellipsis" style={styles.headerFooter} onClick={showPopup} />
      {popup}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      allMedia: {
        color: Styles.globalColors.blueDark,
        marginLeft: 'auto',
        padding: Styles.globalMargins.small,
      },
      animated: {
        height: 50,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      assetWrapper: {
        ...Styles.globalStyles.flexBoxCenter,
        flex: 1,
      },
      close: {
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
