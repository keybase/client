import * as React from 'react'
import {
  Box,
  Box2,
  Icon,
  Text,
  OrientedImage,
  PopupDialog,
  ProgressBar,
  ProgressIndicator,
  OverlayParentHOC,
  OverlayParentProps,
} from '../../../common-adapters'
import MessagePopup from '../messages/message-popup'
import * as Styles from '../../../styles'
import {Props} from '.'
import KeyHandler from '../../../util/key-handler.desktop'

type State = {
  loaded: string
  isZoomed: boolean
}

class _Fullscreen extends React.Component<Props & OverlayParentProps, State> {
  _vidRef: {current: HTMLVideoElement | null} = React.createRef()
  _mounted = false
  state = {isZoomed: false, loaded: ''}
  _setLoaded = (path: string) => this.setState({loaded: path})
  _isLoaded = () => this.props.path.length > 0 && this.props.path === this.state.loaded

  componentDidMount() {
    this._mounted = true
    if (this._vidRef.current && this.props.autoPlay) {
      this._vidRef.current.play()
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    return (
      <PopupDialog onClose={this.props.onClose} fill={true}>
        <Box style={styles.container}>
          <Box style={styles.headerFooter}>
            <Text type="BodySemibold" style={{color: Styles.globalColors.black, flex: 1}}>
              {this.props.title}
            </Text>
            <Icon
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
          </Box>
          {this.props.path && (
            <Box
              style={Styles.collapseStyles([
                this.state.isZoomed ? styles.contentsZoom : styles.contentsFit,
                this._isLoaded() ? null : {display: 'none'},
              ])}
              onClick={() => {
                if (!this.props.isVideo) {
                  this.setState(p => ({isZoomed: !p.isZoomed}))
                }
              }}
              key={this.props.path}
            >
              {!this.props.isVideo ? (
                <OrientedImage
                  src={this.props.path}
                  style={this.state.isZoomed ? styles.imageZoom : styles.imageFit}
                  onLoad={() => {
                    if (this._mounted) {
                      this._setLoaded(this.props.path)
                    }
                  }}
                />
              ) : (
                <video
                  style={styles.videoFit}
                  onLoadedMetadata={() => this._setLoaded(this.props.path)}
                  controlsList="nodownload nofullscreen noremoteplayback"
                  controls={true}
                  ref={this._vidRef}
                >
                  <source src={this.props.path} />
                  <style>{showPlayButton}</style>
                </video>
              )}
            </Box>
          )}
          {!this._isLoaded() && (
            <Box2 direction="horizontal" fullHeight={true} fullWidth={true} centerChildren={true}>
              <ProgressIndicator type="Huge" style={{margin: 'auto'}} />
            </Box2>
          )}
          <Box style={styles.headerFooter}>
            {!!this.props.progressLabel && (
              <Text
                type="BodySmall"
                style={{color: Styles.globalColors.black_50, marginRight: Styles.globalMargins.tiny}}
              >
                {this.props.progressLabel}
              </Text>
            )}
            {!!this.props.progressLabel && <ProgressBar ratio={this.props.progress} />}
            {!this.props.progressLabel && this.props.onDownloadAttachment && (
              <Text type="BodySmall" style={styles.link} onClick={this.props.onDownloadAttachment}>
                Download
              </Text>
            )}
            {this.props.onShowInFinder && (
              <Text type="BodySmall" style={styles.link} onClick={this.props.onShowInFinder}>
                Show in {Styles.fileUIName}
              </Text>
            )}
          </Box>
        </Box>
      </PopupDialog>
    )
  }
}

const Af = KeyHandler(OverlayParentHOC(_Fullscreen as any))
const Fullscreen = (p: Props) => {
  const {onNextAttachment, onPreviousAttachment, ...rest} = p
  return (
    <Af
      hotkeys={['left', 'right']}
      onHotkey={(cmd: string) => {
        cmd === 'left' && onPreviousAttachment()
        cmd === 'right' && onNextAttachment()
      }}
      {...rest}
    />
  )
}

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
