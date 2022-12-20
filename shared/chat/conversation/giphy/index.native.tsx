import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import type {Props} from '.'

class GiphySearch extends React.Component<Props> {
  render() {
    const source = {
      uri: this.props.galleryURL,
    }
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
        {this.props.previews ? (
          <Kb.NativeWebView
            allowsInlineMediaPlayback={true}
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {height: 80},
    } as const)
)

export default GiphySearch
