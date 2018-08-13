// @flow
import * as React from 'react'
import {globalColors, globalMargins} from '../../styles'
import {WebView} from '../../common-adapters'
import {type TextViewProps} from './text-view'
import type {WebViewInjections} from '../../common-adapters'

const TextView = ({url, onInvalidToken, onLoadingStateChange}: TextViewProps) => (
  <WebView url={url} injections={injections} onLoadingStateChange={onLoadingStateChange} />
)

// We need to do the spacing in the guest content of the webView rather than
// the component's styles, to make it feel like the whole "view" is
// scrollable".  The <body> element has the actual content, while <html>
// provides the top and bottom margin that blends with the rest of the app.
const webviewCSS = `
html{
  background-color: ${globalColors.blue5};
  padding-top: 32; 
  padding-bottom: 32; 
  margin: 0;
}
body{
  background-color: ${globalColors.white};
  padding: ${globalMargins.medium};
  margin: 0;
  color: ${globalColors.black_60};
  font-size: 15;
  line-height: 1.6;
`

const injections: WebViewInjections = {
  css: webviewCSS,
}

export default TextView
