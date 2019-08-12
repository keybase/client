import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import MessagePopup from '../messages/message-popup/'
import {Props} from './index.types'
import {Video as ExpoVideo} from 'expo-av'
import logger from '../../../logger'

class _Fullscreen extends React.Component<Props & Kb.OverlayParentProps, {loaded: boolean}> {
  static navigationOptions = () => ({
    header: undefined,
    headerHideBorder: false,
    headerStyle: {
      backgroundColor: Styles.globalColors.transparent,
      borderBottomColor: Styles.globalColors.transparent,
    },
    headerTintColor: Styles.globalColors.white,
    headerTitle: null,
    headerTransparent: true,
    underNotch: true,
  })
  state = {loaded: false}
  _setLoaded = () => this.setState({loaded: true})
  render() {
    return (
      <Kb.Box2
        direction="vertical"
        style={{backgroundColor: Styles.globalColors.black}}
        fullWidth={true}
        fullHeight={true}
      >
        <Kb.SafeAreaViewTop style={{backgroundColor: Styles.globalColors.black}} />
        <Kb.NativeStatusBar hidden={true} />
        <Kb.Text
          type="Body"
          onClick={this.props.onClose}
          style={{color: Styles.globalColors.white, padding: Styles.globalMargins.small}}
        >
          Close
        </Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true} style={Styles.globalStyles.flexGrow}>
          {!!this.props.path && this.props.isVideo ? (
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              centerChildren={true}
              style={{position: 'relative'}}
            >
              <ExpoVideo
                source={{uri: `${this.props.path}&contentforce=true`}}
                onError={e => {
                  logger.error(`Error loading vid: ${JSON.stringify(e)}`)
                }}
                onLoad={this._setLoaded}
                shouldPlay={false}
                useNativeControls={true}
                style={{
                  height: this.props.previewHeight,
                  width: this.props.previewWidth,
                }}
              />
            </Kb.Box2>
          ) : (
            <Kb.ZoomableImage
              style={{
                height: '100%',
                opacity: this.state.loaded ? 1 : 0,
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
              }}
              uri={this.props.path}
              onLoad={this._setLoaded}
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
      </Kb.Box2>
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
