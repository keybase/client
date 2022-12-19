import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {memoize} from '../../../../../util/memoize'
import logger from '../../../../../logger'
import {Video, ResizeMode, type AVPlaybackStatus} from 'expo-av'
import type {Props} from './image-render.types'

type State = {
  showVideo: boolean
}

export class ImageRender extends React.Component<Props, State> {
  state = {showVideo: false}

  onVideoClick = () => {
    this.setState({showVideo: true})
  }

  _allLoads = () => {
    this.props.onLoad()
    this.props.onLoadedVideo()
  }

  private getSource = memoize((videoSrc: string) => {
    const uri = videoSrc.length > 0 ? videoSrc : 'https://'
    return {
      uri: `${uri}&contentforce=true&poster=${encodeURIComponent(this.props.src)}`,
    }
  })

  private onErrorVid = e => {
    logger.error(`Error loading vid: ${JSON.stringify(e)}`)
  }

  private getSizeStyle = memoize((s, height, width) => Styles.collapseStyles([s, {height, width}]))
  private getFISource = memoize(uri => ({uri}))
  _videoRef = React.createRef<Video>()
  _onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return
    }

    if (status.didJustFinish) {
      await this._videoRef.current?.setPositionAsync(0)
    }
  }

  render() {
    if (this.props.inlineVideoPlayable && this.props.videoSrc.length > 0) {
      const source = this.getSource(this.props.videoSrc)

      const {height, width} = this.props
      return (
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.container, this.props.style, {height, width}])}
        >
          {this.state.showVideo ? (
            <Video
              ref={this._videoRef}
              onPlaybackStatusUpdate={this._onPlaybackStatusUpdate}
              source={source}
              useNativeControls={true}
              onLoad={this._allLoads}
              onError={this.onErrorVid}
              shouldPlay={true}
              style={this.getSizeStyle(styles.video, height, width)}
              resizeMode={ResizeMode.CONTAIN}
            />
          ) : (
            <Kb.NativeFastImage
              onLoad={this.props.onLoad}
              source={this.getFISource(this.props.src)}
              resizeMode="cover"
              style={styles.poster}
            />
          )}
        </Kb.Box2>
      )
    }
    return (
      <Kb.NativeFastImage
        onLoad={this.props.onLoad}
        source={this.getFISource(this.props.src)}
        style={this.props.style}
        resizeMode="cover"
      />
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
      poster: {...Styles.globalStyles.fillAbsolute, borderRadius: Styles.borderRadius},
      video: {borderRadius: Styles.borderRadius},
    } as const)
)

export function imgMaxWidth() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return Math.min(320, maxWidth - 68)
}

export function imgMaxWidthRaw() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return maxWidth
}

export function imgMaxHeightRaw() {
  const {height: maxHeight} = Kb.NativeDimensions.get('window')
  return maxHeight
}
