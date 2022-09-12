import * as React from 'react'
import * as Kb from '../../../common-adapters'
import MessagePopup from '../messages/message-popup'
import * as Styles from '../../../styles'
import type {Props} from '.'

type ArrowProps = {
  left: boolean
  onClick: () => void
}

const Arrow = (props: ArrowProps) => {
  const {left, onClick} = props
  return (
    <Kb.Box
      className="hover_background_color_black background_color_black_50 fade-background-color"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation()
        onClick()
      }}
      style={styles.circle}
    >
      <Kb.Icon
        type={left ? 'iconfont-arrow-left' : 'iconfont-arrow-right'}
        color={Styles.globalColors.white}
        style={Styles.collapseStyles([styles.arrow, left && styles.arrowLeft, !left && styles.arrowRight])}
      />
    </Kb.Box>
  )
}

const _Fullscreen = (p: Props & Kb.OverlayParentProps) => {
  const {path, title, message, progress, progressLabel} = p
  const {onNextAttachment, onPreviousAttachment, onClose, onDownloadAttachment, onShowInFinder, isVideo} = p
  const {setAttachmentRef, toggleShowingMenu, showingMenu, getAttachmentRef} = p
  const [isZoomed, setIsZoomed] = React.useState(false)

  const isMountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const vidRef = React.useRef(null)
  const hotKeys = ['left', 'right']
  const onHotKey = (cmd: string) => {
    cmd === 'left' && onPreviousAttachment()
    cmd === 'right' && onNextAttachment()
  }
  const isDownloadError = !!message.transferErrMsg

  const [imgSize, setImgSize] = React.useState({height: 0, width: 0})

  React.useEffect(() => {
    const img = new Image()
    img.src = path
    img.onload = () => {
      isMountedRef.current && setImgSize({height: img.naturalHeight, width: img.naturalWidth})
    }
  }, [path])

  const onImageMouseLeave = React.useCallback(() => {
    const target = document.getElementById('imgAttach')
    if (!target) return
    target.style.transform = ''
  }, [])

  const initialZoomRatio = 1.2
  const [zoomRatio, setZoomRatio] = React.useState(initialZoomRatio)

  React.useEffect(() => {
    !isZoomed && onImageMouseLeave()
  }, [onImageMouseLeave, isZoomed])

  const onImageWheel = React.useCallback(e => {
    setZoomRatio(z => {
      const diff = e.deltaY > 0 ? 0.07 : -0.07
      const next = Math.max(0.1, Math.min(z + diff, 20))
      return next
    })
  }, [])

  const lastEvent = React.useRef<React.MouseEvent<HTMLDivElement> | undefined>()

  const adjustImageStyle = React.useCallback(() => {
    const e = lastEvent.current
    const parent = document.getElementById('scrollAttach')
    const img = document.getElementById('imgAttach')
    if (!e || !parent || !img) {
      return
    }
    if (!isZoomed) {
      img.style.transform = ''
      return
    }

    const rect = parent.getBoundingClientRect()
    // position in parent
    const x = Math.max(0, e.clientX - rect.left)
    const y = Math.max(0, e.clientY - rect.top)
    // ratio in parent
    const xr = x / rect.width
    const yr = y / rect.height
    // image size
    const iw = imgSize.width
    const ih = imgSize.height

    // offset to center ourselves in parent after scaling
    const centerX = rect.width / 2 - (iw * zoomRatio) / 2
    const centerY = rect.height / 2 - (ih * zoomRatio) / 2

    // moving the mouse should translate you to the edges of the image
    const mouseX = centerX + (1 - xr) * 2 * -centerX
    const mouseY = centerY + (1 - yr) * 2 * -centerY

    const temp = [
      // move to middle
      `translate(${-0.5 * iw}px, ${-0.5 * ih}px)`,
      // scale up
      `scale(${zoomRatio})`,
      // move to top left
      `translate(${0.5 * iw * zoomRatio}px, ${0.5 * ih * zoomRatio}px)`,
      // center in parent. you go half the parent rect (img top in center, then go back so your center is center)
      `translate(${centerX}px, ${centerY}px)`,
      // move based on mouse
      `translate(${mouseX}px, ${mouseY}px)`,
    ]
      .reverse() // applied right to left
      .join(' ')
    img.style.transform = temp
  }, [zoomRatio, imgSize, isZoomed])

  React.useEffect(() => {
    adjustImageStyle()
  }, [adjustImageStyle, zoomRatio, isZoomed])

  const onImageMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      lastEvent.current = e
      adjustImageStyle()
    },
    [adjustImageStyle]
  )

  return (
    <Kb.PopupDialog onClose={onClose} fill={true}>
      <Kb.Box style={styles.container}>
        <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKey} />
        <Kb.Box style={styles.headerFooter}>
          <Kb.Markdown lineClamp={2} style={Styles.globalStyles.flexOne} meta={{message: message}}>
            {title}
          </Kb.Markdown>
          <Kb.Icon
            ref={setAttachmentRef}
            type="iconfont-ellipsis"
            style={Styles.platformStyles({
              common: {marginLeft: Styles.globalMargins.tiny},
              isElectron: {cursor: 'pointer'},
            })}
            color={Styles.globalColors.black_50}
            onClick={toggleShowingMenu}
          />
          <MessagePopup
            attachTo={getAttachmentRef}
            message={message}
            onHidden={toggleShowingMenu}
            position="bottom left"
            visible={showingMenu}
          />
        </Kb.Box>
        {path && (
          <Kb.BoxGrow>
            <Kb.ClickableBox
              style={styles.contentsFit}
              key={path}
              onClick={() => {
                if (!isVideo) {
                  setIsZoomed(z => !z)
                  setZoomRatio(initialZoomRatio)
                }
              }}
            >
              {!isZoomed ? <Arrow left={true} onClick={onPreviousAttachment} /> : undefined}
              <Kb.Box2
                direction="vertical"
                fullWidth={true}
                fullHeight={true}
                style={Styles.globalStyles.flexGrow}
                key={path}
              >
                {isVideo ? (
                  <video
                    style={styles.videoFit as any}
                    controlsList="nodownload nofullscreen noremoteplayback"
                    controls={true}
                    ref={vidRef}
                  >
                    <source src={path} />
                    <style>{showPlayButton}</style>
                  </video>
                ) : (
                  <div
                    id="scrollAttach"
                    style={isZoomed ? styles.scrollAttachZoomed : styles.scrollAttachOrig}
                    onMouseMove={onImageMouseMove}
                    onMouseLeave={isZoomed ? onImageMouseLeave : undefined}
                    onWheel={isZoomed ? onImageWheel : undefined}
                  >
                    <img
                      id="imgAttach"
                      src={path}
                      style={isZoomed ? styles.imgZoomed : (styles.imgOrig as any)}
                    />
                  </div>
                )}
              </Kb.Box2>
              {!isZoomed && <Arrow left={false} onClick={onNextAttachment} />}
            </Kb.ClickableBox>
          </Kb.BoxGrow>
        )}
        <Kb.Box style={styles.headerFooter}>
          {!!progressLabel && (
            <Kb.Text
              type="BodySmall"
              style={{color: Styles.globalColors.black_50, marginRight: Styles.globalMargins.tiny}}
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
              Show in {Styles.fileUIName}
            </Kb.Text>
          )}
        </Kb.Box>
      </Kb.Box>
    </Kb.PopupDialog>
  )
}

const Fullscreen = Kb.OverlayParentHOC(_Fullscreen)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      arrow: {
        position: 'relative',
        top: 1,
      },
      arrowLeft: {right: 1},
      arrowRight: {left: 1},
      circle: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          alignSelf: 'center',
          borderRadius: 36,
          cursor: 'pointer',
          flexShrink: 0,
          height: 36,
          justifyContent: 'center',
          margin: Styles.globalMargins.small,
          width: 36,
        },
      }),
      container: {...Styles.globalStyles.flexBoxColumn, height: '100%', width: '100%'},
      contentsFit: {
        ...Styles.globalStyles.flexBoxRow,
        flex: 1,
        height: '100%',
        width: '100%',
      },
      error: {color: Styles.globalColors.redDark},
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 32,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
        width: '100%',
      },
      imgOrig: Styles.platformStyles({
        isElectron: {
          display: 'flex',
          margin: 'auto',
          maxHeight: '100%',
          maxWidth: '100%',
          transform: '',
        },
      }),
      imgZoomed: Styles.platformStyles({
        isElectron: {
          position: 'absolute',
          transformOrigin: 'top left',
        },
      }),
      link: Styles.platformStyles({isElectron: {color: Styles.globalColors.black_50, cursor: 'pointer'}}),
      retry: {
        color: Styles.globalColors.redDark,
        textDecorationLine: 'underline',
      },
      scrollAttachOrig: {
        alignItems: 'center',
        cursor: 'zoom-in',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      },
      scrollAttachZoomed: {
        cursor: 'zoom-out',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      },
      videoFit: Styles.platformStyles({
        isElectron: {
          cursor: 'normal',
          display: 'block',
          height: '100%',
          objectFit: 'scale-down' as const,
          width: '100%',
        },
      }),
    } as const)
)

const showPlayButton = `
video::-webkit-media-controls-play-button {
  display: block;
}
`

export default Fullscreen
