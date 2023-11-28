import * as Kb from '@/common-adapters'
import type {Props} from './text-view'

const TextView = (props: Props) => (
  <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
    <Kb.WebView
      url={props.url}
      pinnedURLMode={true}
      style={styles.webview}
      injections={injections}
      onError={props.onUrlError}
      showLoadingStateUntilLoaded={true}
    />
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      progressContainer: {
        justifyContent: 'center',
        position: 'absolute',
      },
      webview: {
        height: '100%',
        width: '100%',
      },
    }) as const
)

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the rest of the app.
const webviewCSS = `
html{
  background-color: ${Kb.Styles.globalColors.blueLighter3};
  padding-top: ${Kb.Styles.globalMargins.mediumLarge};
  padding-bottom: ${Kb.Styles.globalMargins.mediumLarge};
  margin: 0;
}
body{
  background-color: ${Kb.Styles.globalColors.white};
  padding: ${Kb.Styles.globalMargins.medium};
  margin: 0;
  color: ${Kb.Styles.globalColors.black};
  font-size: 15;
  line-height: 1.6;
}
pre{
  font-family: "${Kb.Styles.globalStyles.fontTerminal.fontFamily}", monospace;
}
`

const injections = {
  css: webviewCSS,
}

export default TextView
