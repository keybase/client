// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import {NativeWebView} from '../../../../../common-adapters/native-wrappers.native'
import type {Props} from './video.types'

export class Video extends React.Component<Props> {
  webview: any
  render() {
    const source = {
      uri: `${this.props.url}&orient=${this.props.orient}`,
    }
    return (
      <Kb.Box2 direction="horizontal" style={this.props.style}>
        <NativeWebView
          allowsInlineMediaPlayback={true}
          useWebKit={true}
          source={source}
          style={this.props.style}
          scrollEnabled={false}
          onLoadEnd={() => {}}
          automaticallyAdjustContentInsets={false}
        />
      </Kb.Box2>
    )
  }
}
