// @flow
import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {NativeWebView} from '../../../../../../common-adapters/native-wrappers.native'
import type {Props} from './video.types'

type State = {
  playingVideo: boolean,
}

const shouldStartLoad = () => {
  return true
}

export class Video extends React.Component<Props, State> {
  _webviewRef = React.createRef()
  state = {playingVideo: this.props.autoPlay}

  _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick()
      return
    }
    if (!(this._webviewRef && this._webviewRef.current)) {
      return
    }
    const arg = this.state.playingVideo ? 'pause' : 'play'
    const runJS = this._webviewRef.current.injectJavaScript
    runJS(`togglePlay("${arg}")`)
    this.setState({playingVideo: !this.state.playingVideo})
  }

  playVideo = () => {
    if (this._webviewRef && this._webviewRef.current) {
      const runJS = this._webviewRef.current.injectJavaScript
      runJS(`togglePlay("play")`)
    }
  }

  pauseVideo = () => {
    if (this._webviewRef && this._webviewRef.current) {
      const runJS = this._webviewRef.current.injectJavaScript
      runJS(`togglePlay("pause")`)
    }
  }

  render() {
    const source = {
      uri: `${this.props.url}&autoplay=${this.props.autoPlay ? 'true' : 'false'}`,
    }
    return (
      <Kb.ClickableBox
        onClick={this._onClick}
        style={Styles.collapseStyles([this.props.style, styles.container])}
      >
        <NativeWebView
          ref={this._webviewRef}
          allowsInlineMediaPlayback={true}
          useWebKit={true}
          source={source}
          style={Styles.collapseStyles([styles.webview, this.props.style])}
          scrollEnabled={false}
          automaticallyAdjustContentInsets={false}
          mediaPlaybackRequiresUserAction={false}
          onShouldStartLoadWithRequest={shouldStartLoad}
        />
        <Kb.Box
          style={Styles.collapseStyles([
            styles.absoluteContainer,
            {
              height: this.props.height,
              width: this.props.width,
            },
          ])}
        >
          {!this.state.playingVideo && !this.props.hidePlayButton && (
            <Kb.Icon type={'icon-play-64'} style={Kb.iconCastPlatformStyles(styles.playButton)} />
          )}
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  absoluteContainer: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
  playButton: {
    bottom: '50%',
    left: '50%',
    marginBottom: -32,
    marginLeft: -32,
    marginRight: -32,
    marginTop: -32,
    position: 'absolute',
    right: '50%',
    top: '50%',
  },
  webview: {
    position: 'relative',
  },
})
