// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import MessagePopup from '../messages/message-popup/'
import type {Props} from './index.types'

const {width: screenWidth, height: screenHeight} = Kb.NativeDimensions.get('window')

class AutoMaxSizeImage extends React.Component<any, {width: number, height: number, loaded: boolean}> {
  state = {height: 0, width: 0, loaded: false}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    Kb.NativeImage.getSize(this.props.source.uri, (width, height) => {
      if (this._mounted) {
        this.setState({height, width})
      }
    })
  }

  _setLoaded = () => this.setState({loaded: true})

  render() {
    return (
      <Kb.ZoomableBox
        contentContainerStyle={{flex: 1, position: 'relative'}}
        maxZoom={10}
        style={{position: 'relative', overflow: 'hidden', width: '100%', height: '100%'}}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Kb.NativeImage
          {...this.props}
          resizeMode="contain"
          style={{
            flex: 1,
            height: Math.min(this.state.height, screenHeight),
            width: Math.min(this.state.width, screenWidth),
            alignSelf: 'center',
            opacity: this.props.opacity,
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
      <Kb.NativeSafeAreaView
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
          {!!this.props.path && (
            <AutoMaxSizeImage
              source={{uri: `${this.props.path}`}}
              onLoad={this._setLoaded}
              opacity={this.state.loaded ? 1 : 0}
            />
          )}
          {!this.state.loaded && (
            <Kb.ProgressIndicator style={{width: 48, position: 'absolute', margin: 'auto'}} white={true} />
          )}
        </Kb.Box>
        <Kb.Icon
          type="iconfont-ellipsis"
          style={styleHeaderFooter}
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
      </Kb.NativeSafeAreaView>
    )
  }
}
const Fullscreen = Kb.OverlayParentHOC(_Fullscreen)

const styleHeaderFooter = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 44,
  paddingLeft: Styles.globalMargins.small,
}

export default Fullscreen
