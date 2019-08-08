import * as React from 'react'
import {VideoState} from './av'
import {Box2} from './box'
import Text from './text'
import {URL} from 'whatwg-url' // URL is not available in rn

type Size = {
  height: number
  width: number
}

// we get string "undefined" if source is audio
const isPositive = thing => typeof thing === 'number' && thing > 0

// getVideoSize returns a size used for sizing <Video />. The width is same
// as container width, then try to maintain aspect ratio, unless height is
// too high, in which case we'll just use container height. It's fine if the
// video is too high, since we use resizeMode="contain".
export const getVideoSize = (state: VideoState): Size => {
  const {containerHeight, containerWidth, videoHeight, videoWidth} = state
  if (!isPositive(containerHeight) || !isPositive(containerWidth)) {
    // On android it seems size 0 doesn't trigger load at all.
    return {height: 1, width: 1}
  }
  if (!isPositive(videoHeight) || !isPositive(videoWidth)) {
    // Might be an audio file. In this case height doesn't seem to affect
    // desktop at all.
    return state.loadedVideoSize ? {height: 96, width: containerWidth} : {height: 0, width: 0}
  }

  const idealHeight = (containerWidth * videoHeight) / videoWidth
  return {
    height: idealHeight > containerHeight ? containerHeight : idealHeight,
    width: containerWidth,
  }
}

export const useVideoSizer = () => {
  const [containerHeight, setContainerHeight] = React.useState(0)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [videoNaturalHeight, setVideoNaturalHeight] = React.useState(0)
  const [videoNaturalWidth, setVideoNaturalWidth] = React.useState(0)
  const [loadedVideoNaturalSize, setLoadedVideoNaturalSize] = React.useState(false)

  const setContainerSize = (height, width) => {
    setContainerHeight(height)
    setContainerWidth(width)
  }
  const setVideoNaturalSize = (height, width) => {
    setVideoNaturalHeight(height)
    setVideoNaturalWidth(width)
    setLoadedVideoNaturalSize(true)
  }

  return [
    getVideoSize({
      containerHeight,
      containerWidth,
      loadedVideoSize: loadedVideoNaturalSize,
      videoHeight: videoNaturalHeight,
      videoWidth: videoNaturalWidth,
    }),
    setContainerSize,
    setVideoNaturalSize,
  ] as const
}

const allowedHosts = ['127.0.0.1', 'localhost']

const urlIsOK = url =>
  // This should be as limited as possible, to avoid injections.
  /^[a-zA-Z0-9=.%:?/&-_]*$/.test(url) &&
  (__STORYBOOK__ || __STORYSHOT__ || allowedHosts.includes(new URL(url).hostname))

type CheckURLProps = {
  url: string
  children: React.ReactNode
}

export const CheckURL: React.FunctionComponent<CheckURLProps> = (props: CheckURLProps) =>
  urlIsOK(props.url) ? (
    (props.children as any)
  ) : (
    <Box2 direction="horizontal" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Text type="BodySmall">Invalid URL: {props.url}</Text>
    </Box2>
  )
