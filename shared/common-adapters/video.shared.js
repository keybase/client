// @flow
import {type State} from './video'

type Size = {
  height: number,
  width: number,
}

// we get string "undefined" if source is audio
const isPositive = thing => typeof thing === 'number' && thing > 0

// getVideoSize returns a size used for sizing <Video />. The width is same
// as container width, then try to maintain aspect ratio, unless height is
// too high, in which case we'll just use container height. It's fine if the
// video is too high, since we use resizeMode="contain".
export const getVideoSize = (state: State): Size => {
  const {containerHeight, containerWidth, videoHeight, videoWidth} = state
  if (!isPositive(containerHeight) || !isPositive(containerWidth)) {
    return {height: 0, width: 0}
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
