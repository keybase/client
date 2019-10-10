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
      <Kb.SafeAreaViewTop style={styles.safeAreaTop}>
        <Kb.Text type="Body" onClick={this.props.onClose} style={styles.close}>
          Close
        </Kb.Text>
        <Kb.Box style={styles.assetWrapper}>
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
          ) : (
            <AutoMaxSizeImage
              source={{uri: `${this.props.path}`}}
              onLoad={this._setLoaded}
              opacity={this.state.loaded ? 1 : 0}
            />
          )}
          {!this.state.loaded && <Kb.ProgressIndicator style={styles.progressIndicator} white={true} />}
        </Kb.Box>
        <Kb.Icon
          type="iconfont-ellipsis"
          // @ts-ignore TODO fix styles
          style={styles.headerFooter}
          color={Styles.globalColors.white}
          onClick={this.props.toggleShowingMenu}
        />
        <MessagePopup
          attachTo={this.props.getAttachmentRef}
          message={this.props.message}
          onHidden={this.props.toggleShowingMenu}
          position="bottom left"
          visible={this.props.showingMenu}
        />
      </Kb.SafeAreaViewTop>
    )
  }
}
const Fullscreen = Kb.OverlayParentHOC(_Fullscreen)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      assetWrapper: {
        ...Styles.globalStyles.flexBoxCenter,
        flex: 1,
      },
      close: {
        color: Styles.globalColors.whiteOrBlueDark,
        padding: Styles.globalMargins.small,
      },
      fastImage: {
        alignSelf: 'center',
        flex: 1,
      },
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: 44,
        paddingLeft: Styles.globalMargins.small,
      },
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
        backgroundColor: Styles.globalColors.white,
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
