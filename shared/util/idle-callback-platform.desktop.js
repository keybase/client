// @flow

const useFallback = typeof window === 'undefined' || !window.requestIdleCallback
const animationFriendlyDelay = useFallback ? null : window.requestIdleCallback

export {animationFriendlyDelay, useFallback}
