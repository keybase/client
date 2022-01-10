import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {memoize} from '../../../../../util/memoize'
import logger from '../../../../../logger'
import {Props} from './image-render.types'
import Video from 'react-native-video'

type State = {
  paused: boolean
  showVideo: boolean
}

export class ImageRender extends React.Component<Props, State> {
  state = {
    paused: false,
    showVideo: false,
  }

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

  render() {
    if (this.props.inlineVideoPlayable && this.props.videoSrc.length > 0) {
      // poster not working correctly so we need this box
      // https://github.com/react-native-community/react-native-video/issues/1509
      const source = this.getSource(this.props.videoSrc)

      const {height, width} = this.props
      return (
        <Kb.Box2 direction="vertical" style={[styles.container, this.props.style, {height, width}]}>
          {this.state.showVideo ? (
            <Video
              source={source}
              controls={!this.state.paused}
              paused={this.state.paused}
              onLoad={this._allLoads}
              onError={this.onErrorVid}
              style={this.getSizeStyle(styles.video, height, width)}
              resizeMode="contain"
              ignoreSilentSwitch="ignore"
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
