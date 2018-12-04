// @flow
import * as React from 'react'
import type {Props} from './video.types'

export class Video extends React.Component<Props> {
  render() {
    return <video autoPlay={true} muted={true} src={this.props.url} style={this.props.style} loop={true} />
  }
}
