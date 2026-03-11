import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useMessagePopup} from '../messages/message-popup'
import type {Props} from '.'
import {useData, usePreviewFallback} from './hooks'
import type {StyleOverride} from '@/common-adapters/markdown'

type ArrowProps = {
  left: boolean
  onClick: () => void
}

const Arrow = (props: ArrowProps) => {
  const {left, onClick} = props
  return (
    <Kb.ClickableBox
      className="hover_background_color_black background_color_black_50 fade-background-color"
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      style={styles.circle}
    >
      <Kb.Icon
        type={left ? 'iconfont-arrow-left' : 'iconfont-arrow-right'}
        color={Kb.Styles.globalColors.white}
        style={Kb.Styles.collapseStyles([styles.arrow, left && styles.arrowLeft, !left && styles.arrowRight])}
      />
    </Kb.ClickableBox>
  )
}

const Fullscreen = function Fullscreen(p: Props) {
  const data = useData(p.ordinal)
  const {message, ordinal, path, title, progress, previewPath} = data
  const {progressLabel, onNextAttachment, onPreviousAttachment} = data
  const {onDownloadAttachment, onShowInFinder, isVideo} = data
  const {fullWidth, fullHeight} = data

  const [isZoomed, setIsZoomed] = React.useState(false)
  const onIsZoomed = (zoomed: boolean) => {
    setIsZoomed(zoomed)
  }

  const preload = (path: string, onLoad: () => void, onError: () => void) => {
    const img = new Image()
    img.src = path
    img.onload = onLoad
    img.onerror = onError
  }

  const imgSrc = usePreviewFallback(path, previewPath, isVideo, data.showPreview, preload)

  const forceDims = fullHeight && fullWidth ? {height: fullHeight, width: fullWidth} : undefined

  const vidRef = React.useRef<HTMLVideoElement>(null)
  const onHotKey = (cmd: string) => {
    cmd === 'left' && onPreviousAttachment()
    cmd === 'right' && onNextAttachment()
  }
  Kb.useHotKey(['left', 'right'], onHotKey)
  const isDownloadError = !!message.transferErrMsg

  const {showPopup, popup, popupAnchor} = useMessagePopup({ordinal})

  const titleOverride = {
    paragraph: Kb.Styles.platformStyles({
      isElectron: {whiteSpace: 'nowrap'},
    }),
  } as StyleOverride

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.headerFooter}>
        <Kb.Markdown lineClamp={2} style={Kb.Styles.globalStyles.flexOne} styleOverride={titleOverride}>
          {title}
        </Kb.Markdown>
        <Kb.Box2 direction="vertical" ref={popupAnchor} style={styles.ellipsisContainer}>
          <Kb.Icon
            type="iconfont-ellipsis"
            color={Kb.Styles.globalColors.black_50}
            onClick={showPopup}
            padding="small"
          />
        </Kb.Box2>
        {popup}
      </Kb.Box2>
      {path && (
        <Kb.BoxGrow>
          <Kb.ClickableBox style={styles.contentsFit} key={path}>
            {!isZoomed ? <Arrow left={true} onClick={onPreviousAttachment} /> : undefined}
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              fullHeight={true}
              style={Kb.Styles.globalStyles.flexGrow}
              key={path}
            >
              {isVideo ? (
                <video
                  autoPlay={true}
                  style={Kb.Styles.castStyleDesktop(styles.videoFit)}
                  controlsList="nodownload nofullscreen noremoteplayback"
                  controls={true}
                  ref={vidRef}
                >
                  <source src={path} />
                </video>
              ) : (
                <Kb.ZoomableImage src={imgSrc} onIsZoomed={onIsZoomed} forceDims={forceDims} />
              )}
            </Kb.Box2>
            {!isZoomed && <Arrow left={false} onClick={onNextAttachment} />}
          </Kb.ClickableBox>
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      arrow: {
        position: 'relative',
        top: 1,
      },
      arrowLeft: {right: 1},
      arrowRight: {left: 1},
      circle: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          alignSelf: 'center',
          borderRadius: 36,
          cursor: 'pointer',
          flexShrink: 0,
          height: 36,
          justifyContent: 'center',
          margin: Kb.Styles.globalMargins.small,
          width: 36,
        },
      }),
      contentsFit: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        flex: 1,
        height: '100%',
        width: '100%',
      },
      // Opt out of the Electron titlebar drag region so the icon gets cursor/click events
      ellipsisContainer: Kb.Styles.platformStyles({
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
      error: {color: Kb.Styles.globalColors.redDark},
      headerFooter: {
        height: 32,
        paddingLeft: Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      link: Kb.Styles.platformStyles({
        isElectron: {color: Kb.Styles.globalColors.black_50, cursor: 'pointer'},
      }),
      retry: {
        color: Kb.Styles.globalColors.redDark,
        textDecorationLine: 'underline',
      },
      videoFit: Kb.Styles.platformStyles({
        isElectron: {
          cursor: 'normal',
          display: 'block',
          height: '100%',
          objectFit: 'scale-down' as const,
          width: '100%',
        },
      }),
    }) as const
)

export default Fullscreen
