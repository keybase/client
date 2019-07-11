import * as React from 'react'
import {
  Box,
  Icon,
  Text,
  OrientedImage,
  PopupDialog,
  ProgressBar,
  ProgressIndicator,
  OverlayParentHOC,
  OverlayParentProps,
} from '../../../common-adapters'
import MessagePopup from '../messages/message-popup/'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  fileUIName,
  platformStyles,
} from '../../../styles'
import {Props} from './index.types'
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
        <Box style={containerStyle}>
          <Box style={headerFooterStyle}>
            <Text type="BodySemibold" style={{color: globalColors.black, flex: 1}}>
              {this.props.title}
            </Text>
            <Icon
              ref={this.props.setAttachmentRef}
              type="iconfont-ellipsis"
              style={platformStyles({
                common: {marginLeft: globalMargins.tiny},
                isElectron: {cursor: 'pointer'},
              })}
              color={globalColors.black_50}
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
              style={collapseStyles([
                this.state.isZoomed ? styleContentsZoom : styleContentsFit,
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
                  style={this.state.isZoomed ? styleImageZoom : styleImageFit}
                  onLoad={() => {
                    if (this._mounted) {
                      this._setLoaded(this.props.path)
                    }
                  }}
                />
              ) : (
                <video
                  style={styleVideoFit}
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
          {!this._isLoaded() && <ProgressIndicator style={{margin: 'auto'}} />}
          <Box style={headerFooterStyle}>
            {!!this.props.progressLabel && (
              <Text type="BodySmall" style={{color: globalColors.black_50, marginRight: globalMargins.tiny}}>
                {this.props.progressLabel}
              </Text>
            )}
            {!!this.props.progressLabel && <ProgressBar ratio={this.props.progress} />}
            {!this.props.progressLabel && this.props.onDownloadAttachment && (
              <Text type="BodySmall" style={linkStyle} onClick={this.props.onDownloadAttachment}>
                Download
              </Text>
            )}
            {this.props.onShowInFinder && (
              <Text type="BodySmall" style={linkStyle} onClick={this.props.onShowInFinder}>
                Show in {fileUIName}
              </Text>
            )}
          </Box>
        </Box>
      </PopupDialog>
    )
  }
}
const Fullscreen: any = KeyHandler(OverlayParentHOC(_Fullscreen as any))

const linkStyle = platformStyles({
  isElectron: {color: globalColors.black_50, cursor: 'pointer'},
})

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  width: '100%',
}

const headerFooterStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  width: '100%',
}

const styleContentsFit = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const styleContentsZoom = {
  display: 'block',
  flex: 1,
  overflow: 'auto',
}

const styleImageFit = {
  cursor: 'zoom-in',
  display: 'block',
  height: '100%',
  objectFit: 'scale-down',
  width: '100%',
}

const styleVideoFit = {
  cursor: 'normal',
  display: 'block',
  height: '100%',
  objectFit: 'scale-down' as const,
  width: '100%',
}

const styleImageZoom = {
  cursor: 'zoom-out',
  display: 'block',
  minHeight: '100%',
  minWidth: '100%',
}

const showPlayButton = `
video::-webkit-media-controls-play-button {
  display: block;
}
`

export default Fullscreen
