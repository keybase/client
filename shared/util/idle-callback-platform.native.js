// @flow
import {InteractionManager} from 'react-native'
import {isAndroid} from '../constants/platform'

// TODO: Re-enable requestIdleCallback for Android once https://github.com/facebook/react-native/issues/9579 is fixed
const useFallback = typeof window === 'undefined' || isAndroid || !window.requestIdleCallback
// Sanity check interactions manager, else it can hang forever
InteractionManager.setDeadline(100)
const animationFriendlyDelay = InteractionManager.runAfterInteractions

export {animationFriendlyDelay, useFallback}
