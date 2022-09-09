import * as React from 'react'
import * as Kb from '../../../common-adapters'
import MessagePopup from '../messages/message-popup'
import * as Styles from '../../../styles'
import type {Props} from '.'

type ArrowProps = {
  left: boolean
  onClick: () => void
}

const HoverBox = Styles.styled(Kb.Box)(() => ({
  ':hover': {
    backgroundColor: Styles.globalColors.black,
  },
  backgroundColor: Styles.globalColors.black_50,
  transition: 'background-color 0.35s ease-in-out',
}))

const Arrow = (props: ArrowProps) => {
  const {left, onClick} = props
  return (
    <HoverBox className="hover_background_color_black" onClick={onClick} style={styles.circle}>
      <Kb.Icon
        type={left ? 'iconfont-arrow-left' : 'iconfont-arrow-right'}
        color={Styles.globalColors.white}
        style={Styles.collapseStyles([styles.arrow, left && styles.arrowLeft, !left && styles.arrowRight])}
      />
    </HoverBox>
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
    target.style.backgroundPosition = 'center'
    target.style.backgroundSize = 'contain'
  }, [])

  React.useEffect(() => {
    !isZoomed && onImageMouseLeave()
  }, [onImageMouseLeave, isZoomed])

  const onImageMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const img = document.getElementById('imgAttach')
      if (!img) return
      const rat = 2
      const w = imgSize.width * rat
      const h = imgSize.height * rat
      const ratio = (rat * h) / w
      const rect = e.currentTarget.getBoundingClientRect()
      const xPos = e.clientX - rect.left
      const yPos = e.clientY - rect.top
      const xPercent = xPos / ((rect.width * ratio) / 100) + '%'
      const yPercent = yPos / ((rect.height * ratio) / 100) + '%'
      img.style.backgroundPosition = xPercent + ' ' + yPercent
      img.style.backgroundSize = w + 'px'
    },
    [imgSize]
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
                    style={{
                      height: '100%',
                      width: '100%',
                    }}
                    onMouseMove={isZoomed ? onImageMouseMove : undefined}
                    onMouseLeave={onImageMouseLeave}
                  >
                    <div
                      id="imgAttach"
                      style={Styles.collapseStyles([
                        isZoomed ? styles.imgZoomed : styles.imgOrig,
                        {backgroundImage: `url(${path})`} as any,
                      ])}
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

      imgZoomed: {
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        height: '100%',
        width: '100%',
      },
      imgOrig: {
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        height: '100%',
        width: '100%',
      },

      link: Styles.platformStyles({isElectron: {color: Styles.globalColors.black_50, cursor: 'pointer'}}),
      retry: {
        color: Styles.globalColors.redDark,
        textDecorationLine: 'underline',
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
