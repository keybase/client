import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {ImageRender} from './image-render'
import {isMobile} from '../../../../../util/container'

type Props = {
  arrowColor: string
  hasProgress: boolean
  height: number
  isCollapsed: boolean
  onClick: () => void
  onCollapse: () => void
  onShowInFinder?: ((e: React.BaseSyntheticEvent) => void)
  onDoubleClick: () => void
  path: string
  fullPath: string
  fileName: string
  progress: number
  progressLabel: string
  showButton: null | 'play' | 'film'
  title: string
  toggleMessageMenu: () => void
  videoDuration: string
  inlineVideoPlayable: boolean
  width: number
}

type State = {
  loaded: boolean
  loadingVideo: 'notloaded' | 'loading' | 'loaded'
  playingVideo: boolean
}

// TODO the relationship between this class and the image renderer is very messy. This thing holds a ton of state
// that it itself doesnt' know about so it has to proxy it and feed it back into the child
class ImageAttachment extends React.PureComponent<Props, State> {
  imageRef: any

  state = {loaded: false, loadingVideo: 'notloaded', playingVideo: false} as State
  _setLoaded = () => this.setState({loaded: true})
  _setVideoLoaded = () => this.setState({loadingVideo: 'loaded'})

  _onClick = () => {
    // Once the user clicks the inline video once, then just let the native controls handle everything else.
    if (this.state.playingVideo) {
      return
    }
    if (this.props.inlineVideoPlayable && this.imageRef) {
      this.imageRef.onVideoClick()
      this.setState(p => ({
        loadingVideo: p.loadingVideo === 'notloaded' ? 'loading' : p.loadingVideo,
        playingVideo: !p.playingVideo,
      }))
    } else {
      this.props.onClick()
    }
  }
  _onDoubleClick = () => {
    if (this.props.inlineVideoPlayable && this.imageRef) {
      this.imageRef.pauseVideo()
    }
    this.props.onDoubleClick()
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodyTiny">{this.props.fileName}</Kb.Text>
          <Kb.Icon
            boxStyle={styles.collapseBox}
            style={styles.collapse}
            onClick={this.props.onCollapse}
            sizeType="Tiny"
            type={this.props.isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
          />
        </Kb.Box2>
        {!this.props.isCollapsed && (
          <Kb.ClickableBox
            style={styles.imageContainer}
            onClick={this._onClick}
            onDoubleClick={this._onDoubleClick}
            onLongPress={this.props.toggleMessageMenu}
          >
            <Kb.Box
              style={Styles.collapseStyles([
                styles.backgroundContainer,
                {
                  // Add 6 extra width+height to the background container to create the background
                  // for the image. We use this in conjunction with the margin to reliably
                  // center the image in the background container.
                  minHeight: this.props.height + 6,
                  minWidth: this.props.width + 6,
                },
              ])}
            >
              {!!this.props.path && (
                <Kb.Box>
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
                    height={this.props.height}
                    width={this.props.width}
                    style={Styles.collapseStyles([
                      styles.image,
                      {
                        backgroundColor: this.state.loaded ? undefined : Styles.globalColors.fastBlank,
                        height: this.props.height,
                        width: this.props.width,
                      },
                    ])}
                  />
                  {this.props.title.length > 0 && (
                    <Kb.Text
                      type="Body"
                      style={Styles.collapseStyles([
                        styles.title,
                        {
                          marginTop: !this.state.loaded && !isMobile ? this.props.height : undefined,
                        },
                      ])}
                    >
                      {this.props.title}
                    </Kb.Text>
                  )}
                  {!this.state.loaded && <Kb.ProgressIndicator style={styles.progress} />}
                </Kb.Box>
              )}
              {!this.state.playingVideo && (
                <Kb.Box
                  style={Styles.collapseStyles([
                    styles.absoluteContainer,
                    {
                      height: this.props.height,
                      width: this.props.width,
                    },
                  ])}
                >
                  {!!this.props.showButton && (
                    <Kb.Icon
                      type={this.props.showButton === 'play' ? 'icon-play-64' : 'icon-film-64'}
                      style={Kb.iconCastPlatformStyles(styles.playButton)}
                    />
                  )}
                  {this.props.videoDuration.length > 0 && this.state.loaded && (
                    <Kb.Box style={styles.durationContainer}>
                      <Kb.Text type={'BodyTinyBold'} style={styles.durationText}>
                        {this.props.videoDuration}
                      </Kb.Text>
                    </Kb.Box>
                  )}
                  {!!this.props.arrowColor && (
                    <Kb.Box style={styles.downloadedIconWrapper}>
                      <Kb.Icon
                        type="iconfont-download"
                        style={Kb.iconCastPlatformStyles(styles.downloadIcon)}
                        color={this.props.arrowColor}
                      />
                    </Kb.Box>
                  )}
                </Kb.Box>
              )}
              {Styles.isMobile && this.state.loadingVideo === 'loading' && (
                <Kb.ProgressIndicator style={styles.progress} />
              )}
            </Kb.Box>
            <Kb.Box style={styles.progressContainer}>
              {!this.props.onShowInFinder && (
                <Kb.Text type={'BodySmall'} style={styles.progressLabel}>
                  {this.props.progressLabel ||
                    '\u00A0' /* always show this so we don't change sizes when we're uploading. This is a short term thing, ultimately we should hoist this type of overlay up over the content so it can go away and we won't be left with a gap */}
                </Kb.Text>
              )}
              {this.props.hasProgress && <Kb.ProgressBar ratio={this.props.progress} />}
            </Kb.Box>
          </Kb.ClickableBox>
        )}
        {this.props.onShowInFinder && (
          <Kb.Text
            type="BodySmallPrimaryLink"
            onClick={this.props.onShowInFinder}
            style={styles.link}
            className={Styles.classNames({'hover-underline': !isMobile})}
          >
            Show in {Styles.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  absoluteContainer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  backgroundContainer: {
    backgroundColor: Styles.globalColors.black_05,
    borderRadius: Styles.borderRadius,
    maxWidth: 330,
    position: 'relative',
  },
  collapse: Styles.platformStyles({
    isMobile: {
      alignSelf: 'center',
    },
  }),
  collapseBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  downloadIcon: {
    maxHeight: 14,
    position: 'relative',
    top: 1,
  },
  downloadedIconWrapper: {
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.fastBlank,
    borderRadius: 20,
    bottom: 0,
    padding: 3,
    position: 'absolute',
    right: 0,
  },
  durationContainer: {
    alignSelf: 'flex-start',
    backgroundColor: Styles.globalColors.black_50,
    borderRadius: 2,
    bottom: Styles.globalMargins.tiny,
    padding: 1,
    position: 'absolute',
    right: Styles.globalMargins.tiny,
  },
  durationText: {
    color: Styles.globalColors.white,
    paddingLeft: 3,
    paddingRight: 3,
  },
  image: {
    ...Styles.globalStyles.rounded,
    backgroundColor: Styles.globalColors.fastBlank,
    margin: 3,
    maxWidth: 320,
    position: 'relative',
  },
  imageContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xtiny,
    width: '100%',
  },
  link: {
    color: Styles.globalColors.black_50,
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
  progress: {
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
  progressContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  progressLabel: {
    color: Styles.globalColors.black_50,
    marginRight: Styles.globalMargins.tiny,
  },
  title: Styles.platformStyles({
    common: {
      padding: 5,
    },
    isElectron: {
      display: 'block',
      wordBreak: 'break-word',
    },
  }),
})

export default ImageAttachment
