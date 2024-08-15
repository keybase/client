import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import {useMessagePopup} from '../messages/message-popup'
import {Video, ResizeMode} from 'expo-av'
import logger from '@/logger'
import {ShowToastAfterSaving} from '../messages/attachment/shared'
import type {Props} from '.'
import {useData, usePreviewFallback} from './hooks'
import {type GestureResponderEvent, Animated, View, useWindowDimensions, Image} from 'react-native'
// TODO bring this back when we update expo-image > 1.8.0
// import {Image} from 'expo-image'

const Fullscreen = React.memo(function Fullscreen(p: Props) {
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

  const imgSrc = usePreviewFallback(path, previewPath, isVideo, data.showPreview, preload)
  const srcDims = React.useMemo(() => {
    return imgSrc === path
      ? {height: data.fullHeight, width: data.fullWidth}
      : {height: data.previewWidth, width: data.previewHeight}
  }, [data.fullHeight, data.fullWidth, data.previewHeight, data.previewWidth, imgSrc, path])
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

  const {width: windowWidth} = useWindowDimensions()
  const needDiff = windowWidth / 3
  const initialTouch = React.useRef(-1)
  const maxTouchesRef = React.useRef(0)
  const onTouchStart = React.useCallback((e: GestureResponderEvent) => {
    // we get calls when the touches increase
    maxTouchesRef.current = Math.max(maxTouchesRef.current, e.nativeEvent.touches.length)
    if (e.nativeEvent.touches.length === 1) {
      initialTouch.current = e.nativeEvent.pageX
    } else {
      initialTouch.current = -1
    }
  }, [])
  const onTouchEnd = React.useCallback(
    (e: GestureResponderEvent) => {
      const maxTouches = maxTouchesRef.current
      maxTouchesRef.current = 0
      const diff = e.nativeEvent.pageX - initialTouch.current
      initialTouch.current = -1
      // we only do swipes on single touch
      if (maxTouches !== 1) {
        return
      }
      if (diff > needDiff) {
        onSwipe(false)
      } else if (diff < -needDiff) {
        onSwipe(true)
      }
    },
    [onSwipe, needDiff]
  )

  if (path) {
    if (isVideo) {
      content = (
        <View style={styles.videoWrapper} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
        </View>
      )
    } else {
      content = (
        <Kb.ZoomableImage
          src={imgSrc}
          style={styles.zoomableBox}
          onSwipe={onSwipe}
          onTap={toggleHeader}
          srcDims={srcDims}
          boxCacheKey="chat-attach"
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
})

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
      progressIndicator: {width: 48},
      progressWrapper: {position: 'absolute'},
      safeAreaTop: {
        ...Styles.globalStyles.flexBoxColumn,
        ...Styles.globalStyles.fillAbsolute,
        backgroundColor: Styles.globalColors.blackOrBlack,
      },
      videoWrapper: {
        alignItems: 'center',
        height: '100%',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
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
