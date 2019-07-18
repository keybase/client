import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {Props} from './text-view'

const TextView = (props: Props) => (
  <Kb.Box2 fullHeight={true} fullWidth={true} direction="vertical">
    <Kb.WebView
      url={props.url}
      style={styles.webview}
      injections={injections}
      onLoadingStateChange={props.onLoadingStateChange}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  webview: {
    height: '100%',
    width: '100%',
  },
})

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the rest of the app.
const webviewCSS = `
html{
  background-color: ${Styles.globalColors.blueLighter3};
  padding-top: ${Styles.globalMargins.mediumLarge};
  padding-bottom: ${Styles.globalMargins.mediumLarge}; 
  margin: 0;
}
body{
  background-color: ${Styles.globalColors.white};
  padding: ${Styles.globalMargins.medium};
  margin: 0;
  color: ${Styles.globalColors.black};
  font-size: 15;
  line-height: 1.6;
}
pre{
  font-family: "${Styles.globalStyles.fontTerminal.fontFamily}", monospace;
}
`

const injections = {
  css: webviewCSS,
}

export default TextView
