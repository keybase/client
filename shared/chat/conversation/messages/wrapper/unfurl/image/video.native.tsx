import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import logger from '../../../../../../logger'
import RNVideo from 'react-native-video'
import {Props} from './video.types'

type State = {
  playingVideo: boolean
}

export class Video extends React.Component<Props, State> {
  state = {playingVideo: this.props.autoPlay}

  _onClick = () => {
    if (this.props.onClick) {
      this.props.onClick()
      return
    }
    this.setState({playingVideo: !this.state.playingVideo})
  }

  render() {
    const uri = this.props.url.length > 0 ? this.props.url : 'https://'
    const source = {
      uri: `${uri}&autoplay=${this.props.autoPlay ? 'true' : 'false'}&contentforce=true`,
    }
    return (
      <Kb.ClickableBox
        onClick={this._onClick}
        style={Styles.collapseStyles([this.props.style, styles.container])}
      >
        <RNVideo
          source={source}
          onError={e => {
            logger.error(`Error loading vid: ${JSON.stringify(e)}`)
          }}
          resizeMode="cover"
          style={Styles.collapseStyles([styles.player, this.props.style])}
          repeat={true}
          paused={!this.state.playingVideo}
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
