import * as Kb from '@/common-adapters'

type Props = {
  url: string
  onUrlError?: (err: string) => void
}

const PDFViewDesktop = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <embed src={props.url} width="100%" height="100%" />
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
      />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  webview: {...Kb.Styles.size('100%')},
}))

export default isMobile ? (isIOS ? PdfViewNative : () => null) : PDFViewDesktop
