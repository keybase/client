// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/native-wrappers.native'
import logger from '../../../../../logger'
import type {Props} from './image-render.types'
import Video from 'react-native-video'

type State = {|paused: boolean|}
export class ImageRender extends React.Component<Props, State> {
  state = {
    paused: true,
  }

  onVideoClick = () => {
    this.setState(({paused}) => ({paused: !paused}))
  }

  _allLoads = () => {
    this.props.onLoad()
    this.props.onLoadedVideo()
  }

  render() {
    if (this.props.inlineVideoPlayable && this.props.videoSrc.length > 0) {
      const source = {
        uri: `${this.props.videoSrc}&contentforce=true&poster=${encodeURIComponent(this.props.src)}`,
      }
      return (
        <Video
          source={source}
          controls={true}
          paused={this.state.paused}
          onLoad={() => this._allLoads()}
          onError={e => {
            logger.error(`Error loading vid: ${JSON.stringify(e)}`)
          }}
          resizeMode="cover"
          style={this.props.style}
        />
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

export function imgMaxWidth() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return Math.min(320, maxWidth - 68)
}
