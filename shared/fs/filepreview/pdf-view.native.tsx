import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type {Props} from './pdf-view'

const PdfView = (props: Props) => (
  <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
    <Kb.WebView
      url={props.url}
      pinnedURLMode={true}
      style={styles.webview}
      onError={props.onUrlError}
      showLoadingStateUntilLoaded={true}
    />
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  webview: {
    height: '100%',
    width: '100%',
  },
}))

// Only supported on iOS for now.
export default C.isIOS ? PdfView : () => null
