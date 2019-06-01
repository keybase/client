import * as React from 'react'
import {Props, State} from './video'
import Box, {Box2} from './box'
import * as Styles from '../styles'
import {memoize} from '../util/memoize'
import {getVideoSize, CheckURL} from './video.shared'
import {NativeStatusBar, NativeWebView} from './native-wrappers.native'

const Kb = {
  Box,
  Box2,
  NativeStatusBar,
  NativeWebView,
}

export default class extends React.PureComponent<Props, State> {
  state = {
    containerHeight: 0,
    containerWidth: 0,
    loadedVideoSize: false,
    videoHeight: 0,
    videoWidth: 0,
  }

  _mounted = false

  _parseMessage = nativeEvent => {
    if (!nativeEvent || !nativeEvent.data) {
      return {}
    }
    try {
      const obj = JSON.parse(nativeEvent.data)
      return obj
    } catch {
      return {}
    }
  }
  _onMessage = ({nativeEvent}) => {
    const {endFullscreen, size} = this._parseMessage(nativeEvent)
    size &&
      this._mounted &&
      this.setState({
        loadedVideoSize: true,
        videoHeight: size.height,
        videoWidth: size.width,
      })
    endFullscreen && NativeStatusBar.setHidden(false)
  }
  _setContainerLayout = ({nativeEvent}) =>
    this.setState({
      containerHeight: nativeEvent.layout.height,
      containerWidth: nativeEvent.layout.width,
    })

  _getSource = memoize(url => ({
    html: getHTML(url),
  }))

  componentDidMount() {
    this._mounted = true
  }

  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    const {height, width} = getVideoSize(this.state)
    return (
      <CheckURL url={this.props.url}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          onLayout={this._setContainerLayout}
          style={this.props.style}
        >
          <Kb.Box style={getVideoSize(this.state)}>
            {/*
              // @ts-ignore style is a valid prop */}
            <Kb.NativeWebView
              source={this._getSource(this.props.url)}
              allowsInlineMediaPlayback={true}
              useWebKit={true}
              style={{
                height,
                maxHeight: height,
                maxWidth: width,
                width,
              }}
              scrollEnabled={true}
              onMessage={this._onMessage}
            />
          </Kb.Box>
        </Kb.Box2>
      </CheckURL>
    )
  }
}

const getHTML = url => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="initial-scale=1.0">
    <style type="text/css">
      html {
        display: block;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: ${Styles.globalColors.blueLighter3};
      }
      body {
        display: block;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
      }
      video {
        margin: 0;
        position: absolute;
        height: 100%;
        width: 100%;
        max-height: 100%;
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    <video id="video" autoplay preload="metadata" src="${
      // url is already escaped, and sanity-checked by urlIsOK from
      // video.shared.js.
      url
    }" controls playsinline muted/>
    <script>
      const post = (data) =>
         window.ReactNativeWebView.postMessage.length !== 1
           ? setTimeout(() => post(data), 100)
           : window.ReactNativeWebView.postMessage(data)

      const v = document.getElementById('video')
      v.addEventListener('loadedmetadata', e => {
        post(JSON.stringify({
          size: {
            height: v.videoHeight,
            width: v.videoWidth,
          }
        }))
      })

      v.addEventListener("webkitendfullscreen", () =>
        post(JSON.stringify({ endFullscreen: true }))
      )
    </script>
  </body>
</html>
`
