import * as React from 'react'
import * as Kb from '../../../common-adapters'
import MessagePopup from '../messages/message-popup'
import * as Styles from '../../../styles'
import type {Props} from '.'

type State = {
  loaded: string
  isZoomed: boolean
}

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

class _Fullscreen extends React.Component<Props & Kb.OverlayParentProps, State> {
  state = {isZoomed: false, loaded: ''}

  private vidRef: {current: HTMLVideoElement | null} = React.createRef()
  private mounted = false
  private setLoaded = (path: string) => this.setState({loaded: path})
  private isLoaded = () => this.props.path.length > 0 && this.props.path === this.state.loaded
  private hotKeys = ['left', 'right']
  private onHotKey = (cmd: string) => {
    cmd === 'left' && this.props.onPreviousAttachment()
    cmd === 'right' && this.props.onNextAttachment()
  }
  private isDownloadError = () => !!this.props.message.transferErrMsg

  componentDidMount() {
    this.mounted = true
    if (this.vidRef.current && this.props.autoPlay) {
      this.vidRef.current
        .play()
        .then(() => {})
        .catch(() => {})
    }
  }

  componentWillUnmount() {
    this.mounted = false
  }

  render() {
    return (
      <Kb.PopupDialog onClose={this.props.onClose} fill={true}>
        <Kb.Box style={styles.container}>
          <Kb.HotKey hotKeys={this.hotKeys} onHotKey={this.onHotKey} />
          <Kb.Box style={styles.headerFooter}>
            <Kb.Markdown
              lineClamp={2}
              style={Styles.globalStyles.flexOne}
              meta={{message: this.props.message}}
            >
              {this.props.title}
            </Kb.Markdown>
            <Kb.Icon
              ref={this.props.setAttachmentRef}
              type="iconfont-ellipsis"
              style={Styles.platformStyles({
                common: {marginLeft: Styles.globalMargins.tiny},
                isElectron: {cursor: 'pointer'},
              })}
              color={Styles.globalColors.black_50}
              onClick={this.props.toggleShowingMenu}
            />
            <MessagePopup
              attachTo={this.props.getAttachmentRef}
              message={this.props.message}
              onHidden={this.props.toggleShowingMenu}
              position="bottom left"
              visible={this.props.showingMenu}
            />
          </Kb.Box>
          {this.props.path && (
            <Kb.BoxGrow>
              <Kb.Box
                style={Styles.collapseStyles([
                  this.state.isZoomed ? styles.contentsZoom : styles.contentsFit,
                  this.isLoaded() ? null : styles.contentsHidden,
                ])}
                key={this.props.path}
              >
                {!this.state.isZoomed ? (
                  <Arrow left={true} onClick={this.props.onPreviousAttachment} />
                ) : undefined}
                <Kb.Box
                  style={Styles.globalStyles.flexGrow}
                  onClick={() => {
                    if (!this.props.isVideo) {
                      this.setState(p => ({isZoomed: !p.isZoomed}))
                    }
                  }}
                  key={this.props.path}
                >
                  {!this.props.isVideo ? (
                    <Kb.Image
                      src={this.props.path}
                      style={
                        this.state.isZoomed
                          ? (styles.imageZoom as Styles.StylesCrossPlatform)
                          : (styles.imageFit as Styles.StylesCrossPlatform)
                      }
                      onLoad={() => {
                        if (this.mounted) {
                          this.setLoaded(this.props.path)
                        }
                      }}
                    />
                  ) : (
                    <video
                      style={styles.videoFit as any}
                      onLoadedMetadata={() => this.setLoaded(this.props.path)}
                      controlsList="nodownload nofullscreen noremoteplayback"
                      controls={true}
                      ref={this.vidRef}
                    >
                      <source src={this.props.path} />
                      <style>{showPlayButton}</style>
                    </video>
                  )}
                </Kb.Box>
                {!this.state.isZoomed && <Arrow left={false} onClick={this.props.onNextAttachment} />}
              </Kb.Box>
            </Kb.BoxGrow>
          )}
          {!this.isLoaded() && (
            <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} centerChildren={true}>
              <Kb.ProgressIndicator type="Huge" style={{margin: 'auto'}} />
            </Kb.Box2>
          )}
          <Kb.Box style={styles.headerFooter}>
            {!!this.props.progressLabel && (
              <Kb.Text
                type="BodySmall"
                style={{color: Styles.globalColors.black_50, marginRight: Styles.globalMargins.tiny}}
              >
                {this.props.progressLabel}
              </Kb.Text>
            )}
            {!!this.props.progressLabel && <Kb.ProgressBar ratio={this.props.progress} />}
            {!this.props.progressLabel && this.props.onDownloadAttachment && !this.isDownloadError() && (
              <Kb.Text type="BodySmall" style={styles.link} onClick={this.props.onDownloadAttachment}>
                Download
              </Kb.Text>
            )}
            {!this.props.progressLabel && this.props.onDownloadAttachment && this.isDownloadError() && (
              <Kb.Text type="BodySmall" style={styles.error} onClick={this.props.onDownloadAttachment}>
                Failed to download.{' '}
                <Kb.Text type="BodySmall" style={styles.retry} onClick={this.props.onDownloadAttachment}>
                  Retry
                </Kb.Text>
              </Kb.Text>
            )}
            {this.props.onShowInFinder && (
              <Kb.Text type="BodySmall" style={styles.link} onClick={this.props.onShowInFinder}>
                Show in {Styles.fileUIName}
              </Kb.Text>
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.PopupDialog>
    )
  }
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
      contentsFit: {...Styles.globalStyles.flexBoxRow, flex: 1, height: '100%', width: '100%'},
      contentsHidden: {display: 'none'},
      contentsZoom: Styles.platformStyles({
        isElectron: {
          display: 'block',
          height: '100%',
          overflow: 'auto',
          width: '100%',
        },
      }),
      error: {
        color: Styles.globalColors.redDark,
      },
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 32,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
        width: '100%',
      },
      imageFit: Styles.platformStyles({
        isElectron: {
          cursor: 'zoom-in',
          display: 'block',
          height: '100%',
          objectFit: 'scale-down',
          width: '100%',
        },
      }),
      imageZoom: Styles.platformStyles({
        isElectron: {
          cursor: 'zoom-out',
          display: 'block',
          height: '100%',
          width: '100%',
        },
      }),
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
