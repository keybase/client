// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {WebView} from '../../common-adapters'

type Props = {
  url: string,
  onLoadingStateChange: (isLoading: boolean) => void,
}

export default (props: Props) => (
  <WebView
    url={props.url}
    style={Styles.isMobile ? null : Styles.globalStyles.flexGrow}
    injections={injections}
    onLoadingStateChange={props.onLoadingStateChange}
  />
)

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the rest of the app.
const webviewCSS = Styles.isMobile
  ? `
html{
  background-color: ${Styles.globalColors.blue5};
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
  : `
html{
  background-color: ${Styles.globalColors.blue5};
  padding-top: ${Styles.globalMargins.medium}; 
  padding-bottom: ${Styles.globalMargins.medium}; 
  margin: 0;
}
body{
  background-color: ${Styles.globalColors.white};
  padding: ${Styles.globalMargins.xlarge};
  margin: 0;
  color: ${Styles.globalColors.black};
  line-height: 1.38;
  font-size: 14;
}
pre{
  font-family: "${Styles.globalStyles.fontTerminal.fontFamily}", monospace;
}
`

const injections = {
  css: webviewCSS,
}
