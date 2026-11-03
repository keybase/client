import * as Kb from '@/common-adapters'
import {PdfEmbed} from '@/common-adapters/pdf-embed'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type Props = {
  url: string
  onUrlError?: (err: string) => void
}

const PDFViewDesktop = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <PdfEmbed url={props.url} />
  </Kb.Box2>
)

const PdfViewNative = (props: Props) => {
  const styles = useStyles()
  return (
    <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
      <Kb.WebView
        url={props.url}
        pinnedURLMode={true}
        style={styles.webview}
        onError={props.onUrlError}
        showLoadingStateUntilLoaded={true}
        testID={TestIDs.FILES_PDF_PREVIEW}
      />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  webview: {...Kb.Styles.size('100%')},
}))

export default isMobile ? (isIOS ? PdfViewNative : () => null) : PDFViewDesktop
