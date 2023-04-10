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

const Fullscreen = React.memo(function Fullscreen(p: Props) {
  const {path, title, message, progress, progressLabel} = p
  const {onNextAttachment, onPreviousAttachment, onClose, onDownloadAttachment, onShowInFinder, isVideo} = p

  const [isZoomed, setIsZoomed] = React.useState(false)
  const onZoomed = React.useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed)
  }, [])

  const vidRef = React.useRef(null)
  const hotKeys = ['left', 'right']
  const onHotKey = (cmd: string) => {
    cmd === 'left' && onPreviousAttachment()
    cmd === 'right' && onNextAttachment()
  }
  const isDownloadError = !!message.transferErrMsg

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <MessagePopup
      attachTo={attachTo}
      conversationIDKey={message.conversationIDKey}
      ordinal={message.id}
      onHidden={toggleShowingPopup}
      position="bottom left"
      visible={showingPopup}
    />
  ))

  return (
    <Kb.PopupDialog onClose={onClose} fill={true}>
      <Kb.Box style={styles.container}>
        <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKey} />
        <Kb.Box style={styles.headerFooter}>
          <Kb.Markdown lineClamp={2} style={Styles.globalStyles.flexOne}>
            {title}
          </Kb.Markdown>
          <Kb.Icon
            ref={popupAnchor as any}
            type="iconfont-ellipsis"
            style={Styles.platformStyles({
              common: {marginLeft: Styles.globalMargins.tiny},
              isElectron: {cursor: 'pointer'},
            })}
            color={Styles.globalColors.black_50}
            onClick={toggleShowingPopup}
          />
          {popup}
        </Kb.Box>
        {path && (
          <Kb.BoxGrow>
            <Kb.ClickableBox style={styles.contentsFit} key={path}>
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
                    autoPlay={true}
                    style={styles.videoFit as any}
                    controlsList="nodownload nofullscreen noremoteplayback"
                    controls={true}
                    ref={vidRef}
                  >
                    <source src={path} />
                    <style>{showPlayButton}</style>
                  </video>
                ) : (
                  <Kb.ZoomableImage src={path} onZoomed={onZoomed} />
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
})

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
      scrollAttachOrig: Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          cursor: 'zoom-in',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        },
      }),
      scrollAttachZoomed: Styles.platformStyles({
        isElectron: {
          cursor: 'zoom-out',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        },
      }),
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
