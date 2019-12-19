import * as React from 'react'
import * as Kb from '../../../common-adapters'
import MessagePopup from '../messages/message-popup'
import * as Styles from '../../../styles'
import {Props} from '.'

type State = {
  loaded: string
  isZoomed: boolean
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

  componentDidMount() {
    this.mounted = true
    if (this.vidRef.current && this.props.autoPlay) {
      this.vidRef.current.play()
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
            <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.black, flex: 1}}>
              {this.props.title}
            </Kb.Text>
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
            <Kb.Box
              style={Styles.collapseStyles([
                this.state.isZoomed ? styles.contentsZoom : styles.contentsFit,
                this.isLoaded() ? null : {display: 'none'},
              ])}
              onClick={() => {
                if (!this.props.isVideo) {
                  this.setState(p => ({isZoomed: !p.isZoomed}))
                }
              }}
              key={this.props.path}
            >
              {!this.props.isVideo ? (
                <Kb.OrientedImage
                  src={this.props.path}
                  style={this.state.isZoomed ? styles.imageZoom : styles.imageFit}
                  onLoad={() => {
                    if (this.mounted) {
                      this.setLoaded(this.props.path)
                    }
                  }}
                />
              ) : (
                <video
                  style={styles.videoFit}
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
            {!this.props.progressLabel && this.props.onDownloadAttachment && (
              <Kb.Text type="BodySmall" style={styles.link} onClick={this.props.onDownloadAttachment}>
                Download
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
      container: {...Styles.globalStyles.flexBoxColumn, height: '100%', width: '100%'},
      contentsFit: {...Styles.globalStyles.flexBoxRow, flex: 1, height: '100%', width: '100%'},
      contentsZoom: Styles.platformStyles({isElectron: {display: 'block', flex: 1, overflow: 'auto'}}),
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
        isElectron: {cursor: 'zoom-out', display: 'block', minHeight: '100%', minWidth: '100%'},
      }),
      link: Styles.platformStyles({isElectron: {color: Styles.globalColors.black_50, cursor: 'pointer'}}),
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
