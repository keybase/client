import * as React from 'react'
import type {State} from './video'
import {Box2} from './box'
import Text from './text'
import URL from 'url-parse'

const Kb = {
  Box2,
  Text,
}

type Size = {
  height: number
  width: number
}

// we get string "undefined" if source is audio
const isPositive = (thing: unknown) => typeof thing === 'number' && thing > 0

// getVideoSize returns a size used for sizing <Video />. The width is same
// as container width, then try to maintain aspect ratio, unless height is
// too high, in which case we'll just use container height. It's fine if the
// video is too high, since we use resizeMode="contain".
export const getVideoSize = (state: State): Size => {
  const {containerHeight, containerWidth, videoHeight, videoWidth} = state
  if (!isPositive(containerHeight) || !isPositive(containerWidth)) {
    return {height: 0, width: 0}
  }

  // not loaded yet, just use container size
  if (!state.loadedVideoSize) {
    return {
      height: containerHeight,
      width: containerWidth,
    }
  }
  if (!isPositive(videoHeight) || !isPositive(videoWidth)) {
    // Might be an audio file. In this case height doesn't seem to affect
    // desktop at all.
    return {height: 96, width: containerWidth}
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

  const setContainerSize = (height: number, width: number) => {
    setContainerHeight(height)
    setContainerWidth(width)
  }
  const setVideoNaturalSize = (height: number, width: number) => {
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

const urlIsOK = (url: string, allowFile?: boolean) => {
  const allowedHosts = ['127.0.0.1', 'localhost']

  // This should be as limited as possible, to avoid injections.
  if (/^[a-zA-Z0-9=.%:?/&-_]*$/.test(url)) {
    if (__STORYBOOK__ || __STORYSHOT__) {
      return true
    }
    const u = new URL(url)
    if (allowedHosts.includes(u.hostname)) {
      return true
    }

    if (allowFile && u.hostname === '') {
      return true
    }
  }
  return false
}

type CheckURLProps = {
  url: string
  children: React.ReactElement
  allowFile?: boolean
}

export const CheckURL = (props: CheckURLProps) =>
  urlIsOK(props.url, props.allowFile) ? (
    props.children
  ) : (
    <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.Text type="BodySmall">Invalid URL: {props.url}</Kb.Text>
    </Kb.Box2>
  )
