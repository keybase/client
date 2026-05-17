import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type {Props} from './pdf-view.shared'

const PDFViewDesktop = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <embed src={props.url} width="100%" height="100%" />
  </Kb.Box2>
)

const PdfViewNative = (props: Props) => (
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
  webview: {height: '100%', width: '100%'},
}))

export default Kb.Styles.isMobile ? (C.isIOS ? PdfViewNative : () => null) : PDFViewDesktop
