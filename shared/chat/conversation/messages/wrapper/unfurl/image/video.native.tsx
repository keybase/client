import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import logger from '../../../../../../logger'
import {Video as ExpoVideo} from 'expo-av'
import {Props} from './video.types'

type State = {
  playingVideo: boolean
}

export class Video extends React.Component<Props, State> {
  state = {playingVideo: this.props.autoPlay}
  private videoRef: any = React.createRef()

  _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick()
      return
    }
    this.setState(({playingVideo}) => {
      if (!this.videoRef.current) {
        return
      }
      playingVideo ? this.videoRef.current.pauseAsync() : this.videoRef.current.playAsync()
      return {playingVideo: !playingVideo}
    })
  }

  render() {
    /*
    The react-native-video library thinks any URI that doesn't start with /https?:// to be an asset bundled
    with the app, and will straight crash of that is not true. Solution here is if we somehow end up with a
    blank URL in a native video component, then just put some bogus string in there that at least doesn't
    send the library down the crasher path.
    */
    const uri = this.props.url.length > 0 ? this.props.url : 'https://'
    const source = {
      uri: `${uri}&autoplay=${this.props.autoPlay ? 'true' : 'false'}&contentforce=true`,
    }
    return (
      <Kb.ClickableBox
        onClick={this._onClick}
        style={Styles.collapseStyles([this.props.style, styles.container])}
      >
        <ExpoVideo
          source={source}
          onError={e => {
            logger.error(`Error loading vid: ${JSON.stringify(e)}`)
          }}
          resizeMode={ExpoVideo.RESIZE_MODE_COVER}
          style={Styles.collapseStyles([styles.player, this.props.style])}
          isLooping={true}
          isMuted={true}
          shouldPlay={this.props.autoPlay}
          ref={this.videoRef}
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
          {!this.state.playingVideo && (
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
  player: {
    position: 'relative',
  },
})
