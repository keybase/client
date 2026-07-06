import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {useMessagePopup} from '../messages/message-popup'
import logger from '@/logger'

import {useData, usePreviewFallback} from './hooks'
import type {StyleOverride} from '@/common-adapters/markdown'
import {ShowToastAfterSaving} from '../messages/attachment/shared'
import {Animated, View} from 'react-native'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import {Image} from 'expo-image'
import {useVideoPlayer, VideoView} from 'expo-video'
import type * as T from '@/constants/types'

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  initialMessage?: T.Chat.MessageAttachment
  messageID: T.Chat.MessageID
  showHeader?: boolean
}

// Stub type to avoid DOM lib dependency in native tsconfig
type VideoRef = {pause?: () => void}

// Desktop-only: arrow navigation button
type ArrowProps = {
  left: boolean
  onClick?: () => void
}

const Arrow = (props: ArrowProps) => {
  const {left, onClick} = props
  return (
    <Kb.ClickableBox
      direction="vertical"
      centerChildren={true}
      className="hover_background_color_black background_color_black_50 fade-background-color"
      onClick={
        onClick
          ? e => {
              e?.stopPropagation()
              onClick()
            }
          : undefined
      }
      style={Kb.Styles.collapseStyles([styles.circle, !onClick && styles.disabled])}
    >
      <Kb.Icon
        type={left ? 'iconfont-arrow-left' : 'iconfont-arrow-right'}
        color={Kb.Styles.globalColors.white}
        style={Kb.Styles.collapseStyles([styles.arrow, left && styles.arrowLeft, !left && styles.arrowRight])}
      />
    </Kb.ClickableBox>
  )
}

const DesktopFullscreen = (p: Props) => {
  const data = useData(p.conversationIDKey, p.messageID, p.initialMessage)
  const {message, path, title, progress, previewPath} = data
  const {progressLabel, onNextAttachment, onPreviousAttachment} = data
  const {onDownloadAttachment, onShowInFinder, isPlayableMedia} = data
  const {fullWidth, fullHeight} = data
  const {hasMessageID} = data

  const [isZoomed, setIsZoomed] = React.useState(false)

  const preload = (src: string, onLoad: () => void, onError: () => void) => {
    // Use dynamic require to avoid DOM type dependency
    const ctor = (
      globalThis as unknown as {Image?: new () => {src: string; onload: () => void; onerror: () => void}}
    ).Image
    if (!ctor) return
    const img = new ctor()
    img.src = src
    img.onload = onLoad
    img.onerror = onError
  }

  const imgSrc = usePreviewFallback(path, previewPath, isPlayableMedia, data.showPreview, preload)
  const forceDims = fullHeight && fullWidth ? {height: fullHeight, width: fullWidth} : undefined

  const vidRef = React.useRef<VideoRef>(null)
  const onHotKey = (cmd: string) => {
    if (cmd === 'left') {
      onPreviousAttachment?.()
    }
    if (cmd === 'right') {
      onNextAttachment?.()
    }
  }
  Kb.useHotKey(['left', 'right'], onHotKey)
  const isDownloadError = !!message.transferErrMsg

  const {showPopup, popup, popupAnchor} = useMessagePopup({conversationIDKey: p.conversationIDKey, message})

  const titleOverride = {
    paragraph: Kb.Styles.platformStyles({
      isElectron: {whiteSpace: 'nowrap'},
    }),
  } as StyleOverride

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} testID={TestIDs.CHAT_ATTACHMENT_FULLSCREEN}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.headerFooter}>
        <Kb.Markdown lineClamp={2} style={Kb.Styles.globalStyles.flexOne} styleOverride={titleOverride}>
          {title}
        </Kb.Markdown>
        <Kb.Box2 direction="vertical" ref={popupAnchor} style={styles.ellipsisContainer}>
          <Kb.Icon
            type="iconfont-ellipsis"
            color={Kb.Styles.globalColors.black_50}
            onClick={hasMessageID ? showPopup : undefined}
            padding="small"
            style={!hasMessageID ? styles.disabled : undefined}
          />
        </Kb.Box2>
        {popup}
      </Kb.Box2>
      {path && (
        <Kb.BoxGrow>
          <Kb.Box2 direction="horizontal" flex={1} fullWidth={true} fullHeight={true} key={path}>
            {!isZoomed ? <Arrow left={true} onClick={onPreviousAttachment} /> : undefined}
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              fullHeight={true}
              style={Kb.Styles.globalStyles.flexGrow}
              key={path}
            >
              {isPlayableMedia ? (
                <video
                  autoPlay={true}
                  style={Kb.Styles.castStyleDesktop(styles.videoFit)}
                  controlsList="nodownload nofullscreen noremoteplayback"
                  controls={true}
                  ref={vidRef as React.RefObject<HTMLVideoElement>}
                >
                  <source src={path} />
                </video>
              ) : (
                <Kb.ZoomableImage
                  src={imgSrc}
                  onIsZoomed={zoomed => setIsZoomed(zoomed)}
                  forceDims={forceDims}
                />
              )}
            </Kb.Box2>
            {!isZoomed && <Arrow left={false} onClick={onNextAttachment} />}
          </Kb.Box2>
        </Kb.BoxGrow>
      )}
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.headerFooter}>
        {!!progressLabel && (
          <Kb.Text
            type="BodySmall"
            style={{color: Kb.Styles.globalColors.black_50, marginRight: Kb.Styles.globalMargins.tiny}}
          >
            {progressLabel}
          </Kb.Text>
        )}
        {!!progressLabel && <Kb.ProgressBar ratio={progress} />}
        {!progressLabel && onDownloadAttachment && !isDownloadError && (
          <Kb.Text type="BodySmall" style={styles.link} onClick={onDownloadAttachment}>
            Download
          </Kb.Text>
        )}
        {!progressLabel && onDownloadAttachment && isDownloadError && (
          <Kb.Text type="BodySmall" style={styles.error} onClick={onDownloadAttachment}>
            Failed to download.{' '}
            <Kb.Text type="BodySmall" style={styles.retry} onClick={onDownloadAttachment}>
              Retry
            </Kb.Text>
          </Kb.Text>
        )}
        {onShowInFinder && (
          <Kb.Text type="BodySmall" style={styles.link} onClick={onShowInFinder}>
            Show in {Kb.Styles.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type GestureEvent = {
  nativeEvent: {touches: Array<unknown>; pageX: number}
}

const NativeFullscreenVideo = (p: {
  path: string
  previewHeight: number
  onTouchStart: (e: GestureEvent) => void
  onTouchEnd: (e: GestureEvent) => void
  onLoaded: () => void
}) => {
  const {path, previewHeight, onTouchStart, onTouchEnd, onLoaded} = p

  const sourceUri = `${path}&contentforce=true`
  const player = useVideoPlayer(sourceUri)

  React.useEffect(() => {
    const sub = player.addListener('statusChange', ({status, error}) => {
      if (status === 'readyToPlay') {
        onLoaded()
      }
      if (status === 'error' && error) {
        logger.error(`Error loading vid: ${JSON.stringify(error)}`)
      }
    })
    return () => sub.remove()
  }, [player, onLoaded])

  return (
    <View style={styles.videoWrapper} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <VideoView
        player={player}
        nativeControls={true}
        contentFit="contain"
        style={{
          height: Math.max(previewHeight, 100),
          width: '100%',
        }}
      />
    </View>
  )
}

const NativeFullscreen = (p: Props) => {
  const {showHeader: _showHeader = true} = p
  const data = useData(p.conversationIDKey, p.messageID, p.initialMessage)
  const {isPlayableMedia, onClose, message, path, previewHeight, onAllMedia, previewPath} = data
  const {onNextAttachment, onPreviousAttachment} = data
  const {hasMessageID} = data
  const [loaded, setLoaded] = React.useState(false)
  const [showHeader, setShowHeader] = React.useState(_showHeader)
  const fadeAnimRef = React.useRef<Animated.Value | null>(null)
  const [fadeAnim, setFadeAnim] = React.useState<Animated.Value | null>(null)

  React.useEffect(() => {
    fadeAnimRef.current = new Animated.Value(1)
    setFadeAnim(fadeAnimRef.current)
  }, [])

  React.useEffect(() => {
    if (fadeAnim) {
      Animated.timing(fadeAnim, {
        duration: 240,
        toValue: showHeader ? 1 : 0,
        useNativeDriver: true,
      }).start()
    }
  }, [showHeader, fadeAnim])

  const preload = (src: string, onLoad: () => void, onError: () => void) => {
    const f = async () => {
      try {
        await Image.prefetch(src)
        onLoad()
      } catch {
        onError()
      }
    }
    f()
      .then(() => {})
      .catch(() => {})
  }

  const imgSrc = usePreviewFallback(path, previewPath, isPlayableMedia, data.showPreview, preload)
  const srcDims =
    imgSrc === path
      ? {height: data.fullHeight, width: data.fullWidth}
      : {height: data.previewHeight, width: data.previewWidth}

  const {showPopup, popup} = useMessagePopup({conversationIDKey: p.conversationIDKey, message})

  const onSwipe = (left: boolean) => {
    if (left) {
      onNextAttachment?.()
    } else {
      onPreviousAttachment?.()
    }
  }

  const toggleHeader = () => {
    setShowHeader(s => !s)
  }

  const {width: windowWidth} = useSafeAreaFrame()
  const needDiff = windowWidth / 3
  const initialTouch = React.useRef(-1)
  const maxTouchesRef = React.useRef(0)
  const onTouchStart = (e: GestureEvent) => {
    maxTouchesRef.current = Math.max(maxTouchesRef.current, e.nativeEvent.touches.length)
    if (e.nativeEvent.touches.length === 1) {
      initialTouch.current = e.nativeEvent.pageX
    } else {
      initialTouch.current = -1
    }
  }
  const onTouchEnd = (e: GestureEvent) => {
    const maxTouches = maxTouchesRef.current
    maxTouchesRef.current = 0
    const diff = e.nativeEvent.pageX - initialTouch.current
    initialTouch.current = -1
    if (maxTouches !== 1) return
    if (diff > needDiff) {
      onSwipe(false)
    } else if (diff < -needDiff) {
      onSwipe(true)
    }
  }

  let content: React.ReactNode = null
  let spinner: React.ReactNode = null

  if (isPlayableMedia) {
    if (path) {
      content = (
        <NativeFullscreenVideo
          key={path}
          path={path}
          previewHeight={previewHeight}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onLoaded={() => setLoaded(true)}
        />
      )
    }
  } else if (imgSrc) {
    content = (
      <Kb.ZoomableImage
        src={imgSrc}
        style={styles.zoomableBox}
        onSwipe={hasMessageID ? onSwipe : undefined}
        onTap={toggleHeader}
        srcDims={srcDims}
        boxCacheKey="chat-attach"
      />
    )
  }

  if (!loaded && isPlayableMedia) {
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
      relative={true}
      style={{backgroundColor: Kb.Styles.globalColors.blackOrBlack}}
      fullWidth={true}
      fullHeight={true}
    >
      {spinner}
      <ShowToastAfterSaving transferState={message.transferState} />
      <Kb.BoxGrow>{content}</Kb.BoxGrow>
      <Animated.View style={[styles.animated, {opacity: fadeAnim ?? 1}]}>
        <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} style={styles.headerWrapper}>
          <Kb.Text type="Body" onClick={onClose} style={styles.close}>
            Close
          </Kb.Text>
          <Kb.Text type="Body" onClick={onAllMedia} style={styles.allMedia}>
            All media
          </Kb.Text>
        </Kb.Box2>
      </Animated.View>
      <Kb.IconButton
        disabled={!hasMessageID}
        icon="iconfont-ellipsis"
        style={styles.headerFooter}
        onClick={hasMessageID ? showPopup : undefined}
      />
      {popup}
    </Kb.Box2>
  )
}

const Fullscreen = (p: Props) => {
  if (!isMobile) return <DesktopFullscreen {...p} />
  return <NativeFullscreen {...p} />
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      allMedia: Kb.Styles.platformStyles({
        isMobile: {
          color: Kb.Styles.globalColors.blueDark,
          marginLeft: 'auto',
          padding: Kb.Styles.globalMargins.small,
        },
      }),
      animated: Kb.Styles.platformStyles({
        isMobile: {
          height: 50,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
      }),
      arrow: {
        position: 'relative',
        top: 1,
      },
      arrowLeft: {right: 1},
      arrowRight: {left: 1},
      circle: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          borderRadius: 36,
          flexShrink: 0,
          ...Kb.Styles.size(36),
          margin: Kb.Styles.globalMargins.small,
        },
      }),
      close: Kb.Styles.platformStyles({
        isMobile: {
          color: Kb.Styles.globalColors.blueDark,
          padding: Kb.Styles.globalMargins.small,
        },
      }),
      disabled: {opacity: 0.3},
      ellipsisContainer: Kb.Styles.platformStyles({
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
      error: {color: Kb.Styles.globalColors.redDark},
      headerFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny),
        },
        isElectron: {
          alignItems: 'center',
          height: 32,
        },
        isMobile: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.blackOrBlack,
          bottom: Kb.Styles.globalMargins.small,
          flexShrink: 0,
          ...Kb.Styles.size(34),
          left: Kb.Styles.globalMargins.small,
          position: 'absolute',
          zIndex: 3,
        },
      }),
      headerWrapper: Kb.Styles.platformStyles({
        isMobile: {backgroundColor: Kb.Styles.globalColors.blackOrBlack},
      }),
      link: Kb.Styles.platformStyles({
        isElectron: {color: Kb.Styles.globalColors.black_50, cursor: 'pointer'},
      }),
      progressIndicator: Kb.Styles.platformStyles({isMobile: {width: 48}}),
      progressWrapper: Kb.Styles.platformStyles({isMobile: {position: 'absolute'}}),
      retry: {
        color: Kb.Styles.globalColors.redDark,
        textDecorationLine: 'underline',
      },
      videoFit: Kb.Styles.platformStyles({
        isElectron: {
          cursor: 'normal',
          display: 'block',
          ...Kb.Styles.size('100%'),
          objectFit: 'scale-down' as const,
        },
      }),
      videoWrapper: Kb.Styles.platformStyles({
        isMobile: {
          ...Kb.Styles.centered(),
          ...Kb.Styles.size('100%'),
          position: 'relative',
        },
      }),
      zoomableBox: Kb.Styles.platformStyles({
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.blackOrBlack,
          ...Kb.Styles.size('100%'),
          position: 'relative',
        },
      }),
    }) as const
)

export default Fullscreen
