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
        contentContainerStyle={{flex: 1, position: 'relative'}}
        maxZoom={10}
        style={{height: '100%', overflow: 'hidden', position: 'relative', width: '100%'}}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Kb.NativeFastImage
          {...this.props}
          resizeMode="contain"
          style={{
            alignSelf: 'center',
            flex: 1,
            height: Math.min(this.state.height, screenHeight),
            opacity: this.props.opacity,
            width: Math.min(this.state.width, screenWidth),
          }}
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
      <Kb.SafeAreaViewTop
        style={{
          backgroundColor: Styles.globalColors.black,
          ...Styles.globalStyles.flexBoxColumn,
          ...Styles.globalStyles.fillAbsolute,
        }}
      >
        <Kb.Text
          type="Body"
          onClick={this.props.onClose}
          style={{color: Styles.globalColors.white, padding: Styles.globalMargins.small}}
        >
          Close
        </Kb.Text>
        <Kb.Box style={{...Styles.globalStyles.flexBoxCenter, flex: 1}}>
          {!!this.props.path && this.props.isVideo ? (
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              centerChildren={true}
              style={{position: 'relative'}}
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
          {!this.state.loaded && (
            <Kb.ProgressIndicator
              style={{alignSelf: 'center', margin: 'auto', position: 'absolute', top: '50%', width: 48}}
              white={true}
            />
          )}
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
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: 44,
        paddingLeft: Styles.globalMargins.small,
      },
    } as const)
)

export default Fullscreen
