import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {ImageRender} from './image-render'
import {isMobile} from '../../../../../util/container'
import {memoize} from '../../../../../util/memoize'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import {ShowToastAfterSaving} from '../shared'

type Props = {
  arrowColor: string
  downloadError: boolean
  hasProgress: boolean
  height: number
  isCollapsed: boolean
  onClick: () => void
  onCollapse: () => void
  onShowInFinder?: (e: React.BaseSyntheticEvent) => void
  onDoubleClick: () => void
  onRetry: () => void
  path: string
  fullPath: string
  fileName: string
  message: Types.MessageAttachment
  progress: number
  transferState: Types.MessageAttachmentTransferState
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
  private setLoaded = () => this.setState({loaded: true})
  private setVideoLoaded = () => this.setState({loadingVideo: 'loaded'})

  private onClick = () => {
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
  private onDoubleClick = () => {
    if (this.props.inlineVideoPlayable && this.imageRef) {
      this.imageRef.pauseVideo()
    }
    this.props.onDoubleClick()
  }

  private memoizedMeta = memoize((message: Props['message']) => {
    return {message}
  })

  render() {
    const progressLabel = Constants.messageAttachmentTransferStateToProgressLabel(this.props.transferState)
    const mobileImageFilename = this.props.message.deviceType === 'mobile'

    return (
      <>
        <ShowToastAfterSaving transferState={this.props.transferState} />
        <Kb.Box2 direction="vertical" fullWidth={true}>
          {(!mobileImageFilename || !Styles.isMobile) && (
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={styles.fileNameContainer}>
              <Kb.Text type="BodyTiny" lineClamp={1}>
                {mobileImageFilename ? 'Image from mobile' : this.props.fileName}
              </Kb.Text>
              <Kb.Icon
                boxStyle={styles.collapseBox}
                style={styles.collapse}
                onClick={this.props.onCollapse}
                sizeType="Tiny"
                type={this.props.isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
              />
            </Kb.Box2>
          )}
          {!this.props.isCollapsed && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.imageContainer}>
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
                  <Kb.Box2 direction="vertical" alignItems="center">
                    <Kb.ClickableBox
                      onClick={this.onClick}
                      onDoubleClick={this.onDoubleClick}
                      onLongPress={this.props.toggleMessageMenu}
                    >
                      <Kb.Box2
                        direction="vertical"
                        alignItems="center"
                        style={{
                          height: this.props.height,
                          margin: 3,
                          overflow: 'hidden',
                          width: this.props.width,
                        }}
                      >
                        <ImageRender
                          ref={ref => {
                            this.imageRef = ref
                          }}
                          src={this.props.path}
                          videoSrc={this.props.fullPath}
                          onLoad={this.setLoaded}
                          onLoadedVideo={this.setVideoLoaded}
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
                                style={styles.playButton}
                              />
                            )}
                            {this.props.videoDuration.length > 0 && this.state.loaded && (
                              <Kb.Box style={styles.durationContainer}>
                                <Kb.Text type="BodyTinyBold" style={styles.durationText}>
                                  {this.props.videoDuration}
                                </Kb.Text>
                              </Kb.Box>
                            )}
                            {!!this.props.arrowColor && (
                              <Kb.Box style={styles.downloadedIconWrapper}>
                                <Kb.Icon
                                  type="iconfont-download"
                                  style={styles.downloadIcon}
                                  color={this.props.arrowColor}
                                />
                              </Kb.Box>
                            )}
                            {!this.state.loaded && (
                              <Kb.Box2
                                direction="vertical"
                                centerChildren={true}
                                style={Styles.collapseStyles([
                                  styles.spinnerContainer,
                                  {
                                    height: this.props.height,
                                    width: this.props.width,
                                  },
                                ])}
                              >
                                <Kb.ProgressIndicator style={styles.progress} />
                              </Kb.Box2>
                            )}
                          </Kb.Box>
                        )}
                      </Kb.Box2>
                    </Kb.ClickableBox>
                    {this.props.title.length > 0 && (
                      <Kb.Box2
                        direction="vertical"
                        style={Styles.collapseStyles([styles.title])}
                        alignItems="flex-start"
                      >
                        <Kb.Markdown
                          meta={this.memoizedMeta(this.props.message)}
                          selectable={true}
                          allowFontScaling={true}
                        >
                          {this.props.title}
                        </Kb.Markdown>
                      </Kb.Box2>
                    )}
                  </Kb.Box2>
                )}
                {Styles.isMobile && this.state.loadingVideo === 'loading' && (
                  <Kb.Box2
                    style={Styles.collapseStyles([
                      styles.spinnerContainer,
                      {
                        height: this.props.height,
                        width: this.props.width,
                      },
                    ])}
                    centerChildren={true}
                    direction="vertical"
                  >
                    <Kb.ProgressIndicator style={styles.progress} />
                  </Kb.Box2>
                )}
              </Kb.Box>
              <Kb.Box style={styles.progressContainer}>
                {!this.props.onShowInFinder && !this.props.downloadError && (
                  <Kb.Text type="BodySmall" style={styles.progressLabel}>
                    {progressLabel ||
                      '\u00A0' /* always show this so we don't change sizes when we're uploading. This is a short term thing, ultimately we should hoist this type of overlay up over the content so it can go away and we won't be left with a gap */}
                  </Kb.Text>
                )}
                {this.props.hasProgress && <Kb.ProgressBar ratio={this.props.progress} />}
                {this.props.downloadError && (
                  <Kb.Text type="BodySmall" style={styles.downloadErrorLabel}>
                    Failed to download.{' '}
                    <Kb.Text type="BodySmall" style={styles.retry} onClick={this.props.onRetry}>
                      Retry
                    </Kb.Text>
                  </Kb.Text>
                )}
              </Kb.Box>
            </Kb.Box2>
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
      </>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      absoluteContainer: {
        position: 'absolute',
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
      downloadErrorLabel: {
        color: Styles.globalColors.redDark,
        marginRight: Styles.globalMargins.tiny,
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
      fileNameContainer: {
        paddingRight: Styles.globalMargins.small,
      },
      image: {
        ...Styles.globalStyles.rounded,
        backgroundColor: Styles.globalColors.fastBlank,
        marginBottom: 3,
        marginLeft: 3,
        marginRight: 3,
        marginTop: 0,
        maxWidth: 320,
        position: 'relative',
      },
      imageContainer: {
        alignItems: 'flex-start',
        alignSelf: 'flex-start',
        paddingBottom: Styles.globalMargins.xtiny,
        paddingTop: Styles.globalMargins.xtiny,
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
      retry: {
        color: Styles.globalColors.redDark,
        textDecorationLine: 'underline',
      },
      spinnerContainer: {
        position: 'absolute',
      },
      title: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          padding: 5,
        },
        isElectron: {
          display: 'block',
          wordBreak: 'break-word',
        } as const,
      }),
    } as const)
)

export default ImageAttachment
