// @flow
import type {Props} from './index.types'

const GiphySearch = (props: Props) => {
  return (
    <NativeWebView
      allowsInlineMediaPlayback={true}
      useWebKit={true}
      source={source}
      style={Styles.collapseStyles([styles.webview, this.props.style])}
      scrollEnabled={false}
      automaticallyAdjustContentInsets={false}
      mediaPlaybackRequiresUserAction={false}
    />
  )
}

export default GiphySearch
