import {Dimensions, useWindowDimensions} from 'react-native'
import {isTablet} from '../platform'

// Desktop and iPad always show the inbox and conversation side by side; there the open thread is
// chatRoot's param. A phone pushes the thread as chatConversation above the tabs, except an iPhone
// whose window is wide and tall enough (an iPhone Duo unfolded on its whole inner screen, 951x669):
// its chatRoot shows both too. A folded Duo and a Duo Split View half are narrower than this, and an
// iPhone in landscape (at most 440 tall) is wide enough but too short.
export const chatAlwaysSplit = !isMobile || isTablet
const phoneSplitMinWidth = 700
const phoneSplitMinHeight = 500
export const chatSplitsByWidth = isIOS && !isTablet
export const chatSplitsAt = (window: {height: number; width: number}) =>
  chatAlwaysSplit ||
  (chatSplitsByWidth && window.width >= phoneSplitMinWidth && window.height >= phoneSplitMinHeight)

// Whether chat shows the inbox and conversation side by side right now
export const isChatSplit = (): boolean => chatSplitsAt(chatSplitsByWidth ? Dimensions.get('window') : {height: 0, width: 0})
const useFixedSplit = () => chatAlwaysSplit
const useWindowSplit = () => chatSplitsAt(useWindowDimensions())
export const useIsChatSplit: () => boolean = chatSplitsByWidth ? useWindowSplit : useFixedSplit

// Desktop and iPad register every route in each tab's stack; a phone's tab stacks hold only their
// root screen, with every other route on the root stack above the tabs. Fixed for the app's life.
export const tabStacksHoldEveryRoute = chatAlwaysSplit

// The route that shows the open thread
export const threadRouteName = (): 'chatRoot' | 'chatConversation' =>
  isChatSplit() ? 'chatRoot' : 'chatConversation'
