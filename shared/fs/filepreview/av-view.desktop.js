// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {type AVViewProps} from './av-view'
import {Box, WebView, type WebViewInjections} from '../../common-adapters'

const AVView = (props: AVViewProps) => (
  <Box style={stylesContainer}>
    <WebView
      style={stylesWebview}
      url="about:blank"
      injections={injections(props.url)}
      onLoadingStateChange={props.onLoadingStateChange}
    />
  </Box>
)

// We are inserting dom manually rather than simply loading the video directly
// to 1) have finer control on the <video> tag, so we can do stuff like
// disabling controls; 2) not rely on webview to detect the video source. For
// example, it may not show a .mov, but prompts user to download it.
const webviewCSS = `
html {
  display: block;
  margin: 0;
  padding: 0;
}
body {
  display: block;
  margin: 0;
  padding: 0;
}
video {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: auto;
  object-fit: contain;
  max-height: 100%;
  max-width: 100%;
}
`

// Double quote around ${url} is necessary as encodeURIComponent encodes double
// quote but not single quote.
const webviewJavaScript = url => `
const v = document.createElement("video")
v.setAttribute('loop', true)
v.setAttribute('controls', true)
v.setAttribute('controlsList', 'nodownload nofullscreen')
v.setAttribute('src', "${url}")
document.getElementsByTagName('body')[0].appendChild(v)
v.play()
`

const injections = (url: string): WebViewInjections => ({
  css: webviewCSS,
  javaScript: webviewJavaScript(url),
})

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginBottom: globalMargins.medium,
  marginTop: globalMargins.medium,
  width: '100%',
}

const stylesWebview = {
  ...globalStyles.flexGrow,
  width: '100%',
}
export default AVView
