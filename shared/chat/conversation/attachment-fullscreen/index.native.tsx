import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import MessagePopup from '../messages/message-popup'
import {Props} from '.'
import RNVideo from 'react-native-video'
import logger from '../../../logger'

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
    return (
      <Kb.Box2
        direction="vertical"
        style={{backgroundColor: Styles.globalColors.blackOrBlack}}
        fullWidth={true}
        fullHeight={true}
      >
        <Kb.SafeAreaViewTop style={{backgroundColor: Styles.globalColors.blackOrBlack}} />
        <Kb.NativeStatusBar hidden={true} />
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerWrapper}>
          <Kb.Text type="Body" onClick={this.props.onClose} style={styles.close}>
            Close
          </Kb.Text>
          <Kb.Text type="Body" onClick={this.props.onAllMedia} style={styles.allMedia}>
            All media
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexGrow}>
          {!!this.props.path && this.props.isVideo ? (
            <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.videoWrapper}>
              <RNVideo
                source={{uri: `${this.props.path}&contentforce=true`}}
                onError={e => {
                  logger.error(`Error loading vid: ${JSON.stringify(e)}`)
                }}
                onLoad={this._setLoaded}
                paused={true}
                controls={true}
                style={{
                  height: this.props.previewHeight,
                  width: this.props.previewWidth,
                }}
                resizeMode="contain"
              />
            </Kb.Box2>
          ) : Styles.isIOS ? (
            <AutoMaxSizeImage
              source={{uri: `${this.props.path}`}}
              onLoad={this._setLoaded}
              opacity={this.state.loaded ? 1 : 0}
            />
          ) : (
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
          )}
          {!this.state.loaded && (
            <Kb.ProgressIndicator
              style={{alignSelf: 'center', margin: 'auto', position: 'absolute', top: '50%', width: 48}}
              white={true}
            />
          )}
        </Kb.Box2>
        <Kb.Icon
          type="iconfont-ellipsis"
          // @ts-ignore TODO fix styles
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
      headerWrapper: {...Styles.globalStyles.flexGrow, backgroundColor: Styles.globalColors.blackOrBlack},
      progressIndicator: {
        alignSelf: 'center',
        margin: 'auto',
        position: 'absolute',
        top: '50%',
        width: 48,
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
