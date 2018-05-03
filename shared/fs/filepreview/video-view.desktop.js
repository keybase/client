// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import {type VideoViewProps} from './video-view'

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

const webviewJavaScript = url => `
const v = document.createElement("video")
v.setAttribute('loop', true)
v.setAttribute('muted', true)
v.setAttribute('src', '${url}')
document.getElementsByTagName('body')[0].appendChild(v)
v.play()
`

class VideoView extends React.PureComponent<VideoViewProps> {
  webviewRef: any

  constructor(props: VideoViewProps) {
    super(props)
    this.webviewRef = React.createRef()
  }
  componentDidMount() {
    this.webviewRef.current.addEventListener('dom-ready', () => {
      this.webviewRef.current.insertCSS(webviewCSS)
      this.webviewRef.current.executeJavaScript(webviewJavaScript(this.props.url))
    })
    this.webviewRef.current.addEventListener('did-get-response-details', ({httpResponseCode}) => {
      httpResponseCode === 403 && this.props.onInvalidToken()
    })
  }
  render() {
    return (
      <Box style={stylesContainer}>
        <webview ref={this.webviewRef} style={stylesWebview} src="about:blank" />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  width: '100%',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: globalMargins.medium,
  marginBottom: globalMargins.medium,
}

const stylesWebview = {
  ...globalStyles.flexGrow,
}

export default VideoView
