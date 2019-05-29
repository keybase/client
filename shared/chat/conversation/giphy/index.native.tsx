import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {NativeWebView} from '../../../common-adapters/native-wrappers.native'
import * as Styles from '../../../styles'
import {Props} from './index.types'

class GiphySearch extends React.Component<Props> {
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
            automaticallyAdjustContentInsets={false}
            mediaPlaybackRequiresUserAction={false}
          />
        ) : (
          <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
            <Kb.ProgressIndicator />
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {height: 80},
})

export default GiphySearch
