// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {type TextViewProps} from './text-view'
import {WebView} from '../../common-adapters'
import type {WebViewInjections} from '../../common-adapters'

const TextView = (props: TextViewProps) => (
  <WebView
    url={props.url}
    style={Styles.globalStyles.flexGrow}
    injections={injections}
    onLoadingStateChange={props.onLoadingStateChange}
  />
)

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the left and right space
// provided by <FilePreview/>
const webviewCSS = `
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
  font-family: ${Styles.globalStyles.fontTerminal.fontFamily}
}
`

const injections: WebViewInjections = {
  css: webviewCSS,
}

export default TextView
