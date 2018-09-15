// @flow
import * as React from 'react'
import {
  Box,
  Text,
  ClickableBox,
  Icon,
  ProgressBar,
  ProgressIndicator,
  iconCastPlatformStyles,
} from '../../../../../common-adapters'
import {
  globalStyles,
  globalMargins,
  globalColors,
  fileUIName,
  platformStyles,
  styleSheetCreate,
  collapseStyles,
} from '../../../../../styles'
import {ImageRender} from './image-render'
import {isMobile} from '../../../../../util/container'

type Props = {
  arrowColor: string,
  hasProgress: boolean,
  height: number,
  onClick: () => void,
  onShowInFinder: null | ((e: SyntheticEvent<any>) => void),
  onDoubleClick: () => void,
  path: string,
  fullPath: string,
  progress: number,
  progressLabel: string,
  showButton: null | 'play' | 'film',
  title: string,
  toggleMessageMenu: () => void,
  videoDuration: string,
  inlineVideoPlayable: boolean,
  width: number,
}

type State = {
  loaded: boolean,
  loadingVideo: 'notloaded' | 'loading' | 'loaded',
  playingVideo: boolean,
}

class ImageAttachment extends React.PureComponent<Props, State> {
  imageRef: any

  state = {loaded: false, playingVideo: false, loadingVideo: 'notloaded'}
  _setLoaded = () => this.setState({loaded: true})
  _setVideoLoaded = () => this.setState({loadingVideo: 'loaded'})

  _onClick = () => {
    if (this.props.inlineVideoPlayable && this.imageRef) {
      this.imageRef.onVideoClick()
      this.setState(p => ({
        playingVideo: !p.playingVideo,
        loadingVideo: p.loadingVideo === 'notloaded' ? 'loading' : p.loadingVideo,
      }))
    } else {
      this.props.onClick()
    }
  }
  _onDoubleClick = () => {
    if (this.props.inlineVideoPlayable && this.imageRef) {
      if (this.state.playingVideo) {
        this._onClick()
      }
    }
    this.props.onDoubleClick()
  }
  _onMouseEnter = () => {
    if (this.props.inlineVideoPlayable && this.imageRef) {
      this.imageRef.onVideoMouseEnter()
    }
  }
  _onMouseLeave = () => {
    if (this.props.inlineVideoPlayable && this.imageRef) {
      this.imageRef.onVideoMouseLeave()
    }
  }

  render() {
    return (
      <React.Fragment>
        <ClickableBox
          style={styles.imageContainer}
          onClick={this._onClick}
          onDoubleClick={this._onDoubleClick}
          onLongPress={this.props.toggleMessageMenu}
          onMouseEnter={this._onMouseEnter}
          onMouseLeave={this._onMouseLeave}
        >
          <Text type="BodySemibold" style={styles.title}>
            {this.props.title}
          </Text>
          <Box
            style={collapseStyles([
              styles.loading,
              !this.state.loaded && styles.spinner,
              {
                height: this.props.height,
                width: this.props.width,
              },
            ])}
          >
            {!!this.props.path && (
              <ImageRender
                ref={ref => {
                  this.imageRef = ref
                }}
                src={this.props.path}
                videoSrc={this.props.fullPath}
                onLoad={this._setLoaded}
                onLoadedVideo={this._setVideoLoaded}
                loaded={this.state.loaded}
                inlineVideoPlayable={this.props.inlineVideoPlayable}
                style={collapseStyles([
                  styles.image,
                  {
                    height: this.props.height,
                    opacity: this.state.loaded ? 1 : 0,
                    width: this.props.width,
                  },
                ])}
              />
            )}
            {(!this.state.loaded || this.state.loadingVideo === 'loading') && (
              <ProgressIndicator style={styles.progress} />
            )}
            {!!this.props.showButton &&
              !this.state.playingVideo && (
                <Icon
                  type={this.props.showButton === 'play' ? 'icon-play-64' : 'icon-film-64'}
                  style={iconCastPlatformStyles(styles.playButton)}
                />
              )}
            {this.props.videoDuration.length > 0 &&
              !this.state.playingVideo &&
              this.state.loaded && (
                <Box style={styles.durationContainer}>
                  <Text type={'BodyTinyBold'} style={styles.durationText}>
                    {this.props.videoDuration}
                  </Text>
                </Box>
              )}
            {!!this.props.arrowColor && (
              <Box style={styles.downloadedIconWrapper}>
                <Icon
                  type="iconfont-download"
                  style={iconCastPlatformStyles(styles.downloadIcon)}
                  color={this.props.arrowColor}
                />
              </Box>
            )}
          </Box>
          <Box style={styles.progressContainer}>
            {!this.props.onShowInFinder && (
              <Text type={'BodySmall'} style={styles.progressLabel}>
                {this.props.progressLabel ||
                  '\u00A0' /* always show this so we don't change sizes when we're uploading. This is a short term thing, ultimately we should hoist this type of overlay up over the content so it can go away and we won't be left with a gap */}
              </Text>
            )}
            {this.props.hasProgress && <ProgressBar ratio={this.props.progress} />}
          </Box>
        </ClickableBox>
        {this.props.onShowInFinder && (
          <Text
            type="BodySmallPrimaryLink"
            onClick={this.props.onShowInFinder}
            style={styles.link}
            className={!isMobile ? 'hover-underline' : undefined}
          >
            Show in {fileUIName}
          </Text>
        )}
      </React.Fragment>
    )
  }
}

const styles = styleSheetCreate({
  spinner: platformStyles({
    isElectron: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
    },
    isMobile: {
      ...globalStyles.flexBoxCenter,
      alignItems: 'center',
      margin: 'auto',
      flex: 1,
    },
  }),
  downloadIcon: {maxHeight: 14},
  downloadedIconWrapper: {
    ...globalStyles.flexBoxCenter,
    backgroundColor: globalColors.fastBlank,
    borderRadius: 20,
    bottom: 0,
    padding: 3,
    position: 'absolute',
    right: 0,
  },
  image: {
    backgroundColor: globalColors.fastBlank,
    maxWidth: 320,
    position: 'relative',
  },
  imageContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    padding: globalMargins.xtiny,
    width: '100%',
  },
  link: {
    color: globalColors.black_60,
  },
  loading: {
    backgroundColor: globalColors.black_05,
    borderRadius: globalMargins.xtiny,
    maxWidth: 320,
    position: 'relative',
  },
  playButton: {
    bottom: '50%',
    left: '50%',
    marginBottom: -32,
    marginLeft: -32,
    marginRight: -32,
    marginTop: -32,
    position: 'absolute',
    right: '50%',
    top: '50%',
  },
  durationContainer: {
    backgroundColor: globalColors.black_60,
    bottom: globalMargins.tiny,
    position: 'absolute',
    right: globalMargins.tiny,
    borderRadius: 2,
    alignSelf: 'flex-start',
    padding: 1,
  },
  durationText: {
    color: globalColors.white,
    paddingLeft: 3,
    paddingRight: 3,
  },
  progressContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  progressLabel: {
    color: globalColors.black_40,
    marginRight: globalMargins.tiny,
  },
  title: platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
  progress: platformStyles({
    isElectron: {
      bottom: '50%',
      left: '50%',
      marginBottom: -24,
      marginLeft: -24,
      marginRight: -24,
      marginTop: -24,
      position: 'absolute',
      right: '50%',
      top: '50%',
      width: 48,
    },
    isMobile: {
      width: 48,
      position: 'absolute',
      margin: 'auto',
    },
  }),
})

export default ImageAttachment
