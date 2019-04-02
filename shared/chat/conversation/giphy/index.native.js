// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {NativeWebView} from '../../../common-adapters/native-wrappers.native'
import * as Styles from '../../../styles'
import type {Props} from './index.types'

class GiphySearch extends React.Component<Props, State> {
  render() {
    const source = {
      uri: this.props.galleryURL,
    }
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
        {this.props.previews ? (
          <NativeWebView
            allowsInlineMediaPlayback={true}
            useWebKit={true}
            source={source}
            style={styles.webview}
            automaticallyAdjustContentInsets={false}
            mediaPlaybackRequiresUserAction={false}
          />
        ) : (
          <Kb.ProgressIndicator />
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    height: 100,
    justifyContent: 'center',
  },
  webview: {
    position: 'relative',
  },
})

export default GiphySearch
