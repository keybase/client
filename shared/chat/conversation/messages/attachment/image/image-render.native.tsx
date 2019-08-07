import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import logger from '../../../../../logger'
import {Props} from './image-render.types'
import {Video} from 'expo-av'

type State = {
  paused: boolean
  showVideo: boolean
}

export class ImageRender extends React.Component<Props, State> {
  state = {
    paused: false,
    showVideo: false,
  }
  private videoRef: any = React.createRef()

  onVideoClick = () => {
    this.videoRef.current && this.videoRef.current.playAsync()
    this.setState({showVideo: true})
  }

  _allLoads = () => {
    this.props.onLoad()
    this.props.onLoadedVideo()
  }

  render() {
    if (this.props.inlineVideoPlayable && this.props.videoSrc.length > 0) {
      const uri = this.props.videoSrc.length > 0 ? this.props.videoSrc : 'https://'
      const source = {
        uri: `${uri}&contentforce=true&poster=${encodeURIComponent(this.props.src)}`,
      }
      // poster not working correctly so we need this box
      // https://github.com/react-native-community/react-native-video/issues/1509

      const {height, width} = this.props
      return (
        <Kb.Box2 direction="vertical" style={[styles.container, this.props.style, {height, width}]}>
          {this.state.showVideo ? (
            <Video
              source={source}
              useNativeControls={!this.state.paused}
              onLoad={() => this._allLoads()}
              onError={e => {
                logger.error(`Error loading vid: ${JSON.stringify(e)}`)
              }}
              resizeMode={Video.RESIZE_MODE_COVER}
              style={Styles.collapseStyles([styles.video, {height, width}])}
              shouldPlay={true}
              ref={this.videoRef}
            />
          ) : (
            <Kb.NativeFastImage
              onLoad={this.props.onLoad}
              source={{uri: this.props.src}}
              resizeMode="cover"
              style={styles.poster}
            />
          )}
        </Kb.Box2>
      )
    }
    return (
      <Kb.NativeFastImage
        onLoad={this.props.onLoad}
        source={{uri: this.props.src}}
        style={this.props.style}
        resizeMode="cover"
      />
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {position: 'relative'},
  poster: {...Styles.globalStyles.fillAbsolute, borderRadius: Styles.borderRadius},
  video: {borderRadius: Styles.borderRadius},
})

export function imgMaxWidth() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return Math.min(320, maxWidth - 68)
}

export function imgMaxWidthRaw() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return maxWidth
}
