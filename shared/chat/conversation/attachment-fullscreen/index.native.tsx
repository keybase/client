import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import MessagePopup from '../messages/message-popup'
import {Props} from '.'
import RNVideo from 'react-native-video'
import logger from '../../../logger'
import {ShowToastAfterSaving} from '../messages/attachment/shared'

const {width: screenWidth, height: screenHeight} = Kb.NativeDimensions.get('window')

class AutoMaxSizeImage extends React.Component<
  {
    source: {uri: string}
    onLoad: () => void
    opacity: number
  },
  {
    width: number
    height: number
  }
> {
  state = {height: 0, width: 0}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    Kb.NativeImage.getSize(
      this.props.source.uri,
      (width, height) => {
        if (this._mounted) {
          this.setState({height, width})
        }
      },
      () => {}
    )
  }

  render() {
    return (
      <Kb.ZoomableBox
        contentContainerStyle={styles.zoomableBoxContainer}
        maxZoom={10}
        style={styles.zoomableBox}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Kb.NativeFastImage
          {...this.props}
          resizeMode="contain"
          style={Styles.collapseStyles([
            styles.fastImage,
            {
              height: Math.min(this.state.height, screenHeight),
              opacity: this.props.opacity,
              width: Math.min(this.state.width, screenWidth),
            },
          ])}
        />
      </Kb.ZoomableBox>
    )
  }
}

class _Fullscreen extends React.Component<Props & Kb.OverlayParentProps, {loaded: boolean}> {
  state = {loaded: false}
  _setLoaded = () => this.setState({loaded: true})
  render() {
    let content: React.ReactNode = null
    let spinner: React.ReactNode = null
    if (this.props.path) {
      if (this.props.isVideo) {
        const {previewHeight} = this.props
        content = (
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            fullHeight={true}
            centerChildren={true}
            style={styles.videoWrapper}
          >
            <RNVideo
              source={{uri: `${this.props.path}&contentforce=true`}}
              onError={e => {
                logger.error(`Error loading vid: ${JSON.stringify(e)}`)
              }}
              onLoad={this._setLoaded}
              paused={true}
              controls={true}
              style={{
                height: Math.max(previewHeight, 100),
                width: '100%',
              }}
              resizeMode="contain"
            />
          </Kb.Box2>
        )
      } else {
        if (Styles.isIOS) {
          content = (
            <AutoMaxSizeImage
              source={{uri: `${this.props.path}`}}
              onLoad={this._setLoaded}
              opacity={this.state.loaded ? 1 : 0}
            />
          )
        } else {
          content = (
            <Kb.ZoomableImage
              uri={this.props.path}
              onLoad={this._setLoaded}
              style={{
                height: '100%',
                opacity: this.state.loaded ? 1 : 0,
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
              }}
            />
          )
        }
      }
    }
    if (!this.state.loaded) {
      spinner = (
        <Kb.Box2
          direction="vertical"
          style={styles.progressWrapper}
          centerChildren={true}
          fullHeight={true}
          fullWidth={true}
        >
          <Kb.ProgressIndicator style={styles.progressIndicator} white={true} />
        </Kb.Box2>
      )
    }

    return (
      <Kb.Box2
        direction="vertical"
        style={{backgroundColor: Styles.globalColors.blackOrBlack}}
        fullWidth={true}
        fullHeight={true}
      >
        {spinner}
        <Kb.NativeStatusBar hidden={true} />
        <ShowToastAfterSaving transferState={this.props.message.transferState} />
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerWrapper}>
          <Kb.Text type="Body" onClick={this.props.onClose} style={styles.close}>
            Close
          </Kb.Text>
          <Kb.Text type="Body" onClick={this.props.onAllMedia} style={styles.allMedia}>
            All media
          </Kb.Text>
        </Kb.Box2>
        <Kb.BoxGrow>{content}</Kb.BoxGrow>
        <Kb.Icon
          type="iconfont-ellipsis"
          style={styles.headerFooter}
          color={Styles.globalColors.blueDark}
          onClick={this.props.toggleShowingMenu}
        />
        <MessagePopup
          attachTo={this.props.getAttachmentRef}
          message={this.props.message}
          onHidden={this.props.toggleShowingMenu}
          position="bottom left"
          visible={this.props.showingMenu}
        />
      </Kb.Box2>
    )
  }
}
const Fullscreen = Kb.OverlayParentHOC(_Fullscreen)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      allMedia: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        color: Styles.globalColors.blueDark,
        marginLeft: 'auto',
        padding: Styles.globalMargins.small,
      },
      assetWrapper: {
        ...Styles.globalStyles.flexBoxCenter,
        flex: 1,
      },
      close: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        color: Styles.globalColors.blueDark,
        padding: Styles.globalMargins.small,
      },
      fastImage: {
        alignSelf: 'center',
        flex: 1,
      },
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        bottom: 0,
        flexShrink: 0,
        height: 44,
        left: Styles.globalMargins.small,
        position: 'absolute',
        zIndex: 3,
      },
      headerWrapper: {backgroundColor: Styles.globalColors.blackOrBlack},
      progressIndicator: {
        width: 48,
      },
      progressWrapper: {
        position: 'absolute',
      },
      safeAreaTop: {
        ...Styles.globalStyles.flexBoxColumn,
        ...Styles.globalStyles.fillAbsolute,
        backgroundColor: Styles.globalColors.blackOrBlack,
      },
      videoWrapper: {
        position: 'relative',
      },
      zoomableBox: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      },
      zoomableBoxContainer: {
        flex: 1,
        position: 'relative',
      },
    } as const)
)

export default Fullscreen
