import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import logger from '../../../../../logger'
import {Video, ResizeMode, type AVPlaybackStatus} from 'expo-av'
import type {Props} from './image-render'

export const ImageRender = (p: Props) => {
  const {onLoad, onLoadedVideo, videoSrc, src, height, width, style, inlineVideoPlayable} = p
  const [showVideo /*, setShowVideo*/] = React.useState(false)

  // onVideoClick which calls setShowVideo from parent, change this!

  const allLoads = React.useCallback(() => {
    onLoad()
    onLoadedVideo()
  }, [onLoad, onLoadedVideo])

  const uri = videoSrc.length > 0 ? videoSrc : 'https://'
  const source = {
    uri: `${uri}&contentforce=true&poster=${encodeURIComponent(src)}`,
  }

  const onErrorVid = React.useCallback((e: unknown) => {
    logger.error(`Error loading vid: ${JSON.stringify(e)}`)
  }, [])

  const videoRef = React.useRef<Video | null>(null)
  const fiSrc = React.useMemo(() => ({uri}), [uri])
  const onPlaybackStatusUpdate = React.useCallback(async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return
    }

    if (status.didJustFinish) {
      await videoRef.current?.setPositionAsync(0)
    }
  }, [])

  if (inlineVideoPlayable && videoSrc.length > 0) {
    return (
      <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.container, style, {height, width}])}>
        {showVideo ? (
          <Video
            ref={videoRef}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            source={source}
            useNativeControls={true}
            onLoad={allLoads}
            onError={onErrorVid}
            shouldPlay={true}
            style={Styles.collapseStyles([styles.video, {height, width}])}
            resizeMode={ResizeMode.CONTAIN}
          />
        ) : (
          <Kb.NativeFastImage onLoad={onLoad} source={fiSrc} resizeMode="cover" style={styles.poster} />
        )}
      </Kb.Box2>
    )
  }
  return <Kb.NativeFastImage onLoad={onLoad} source={fiSrc} style={style} resizeMode="cover" />
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
