import * as React from 'react'
import RNVideo from 'react-native-video'
import {Props} from './audio-video'

class AudioVideo extends React.Component<Props> {
  private vidRef = React.createRef<RNVideo>()
  seek = (seconds: number) => {
    if (this.vidRef.current) {
      this.vidRef.current.seek(seconds)
    }
  }
  render() {
    return this.props.url.length > 0 ? (
      <RNVideo
        ref={this.vidRef}
        source={{uri: this.props.url}}
        style={{height: 0, width: 0}}
        paused={this.props.paused}
      />
    ) : null
  }
}

export default AudioVideo
