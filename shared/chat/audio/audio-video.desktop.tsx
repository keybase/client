import * as React from 'react'
import {Props} from './audio-video'

class AudioVideo extends React.Component<Props> {
  private vidRef = React.createRef<HTMLVideoElement>()

  seek = (seconds: number) => {
    if (this.vidRef.current) {
      this.vidRef.current.currentTime = seconds
      if (this.props.paused) {
        this.vidRef.current.pause()
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.vidRef.current) {
      return
    }
    if (this.props.paused && !prevProps.paused) {
      this.vidRef.current.pause()
    } else if (!this.props.paused && prevProps.paused) {
      this.vidRef.current.play()
    }
  }

  render() {
    return <video ref={this.vidRef} src={this.props.url} style={{height: 0, width: 0}} />
  }
}

export default AudioVideo
