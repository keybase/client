import {Dimensions, useWindowDimensions} from 'react-native'
import {isTablet} from '../platform'

// Desktop and iPad always show the inbox and conversation side by side; there the open thread is
// chatRoot's param. A phone pushes the thread as chatConversation above the tabs, except an iPhone
// whose window is wide enough (an iPhone Duo unfolded on its whole inner screen): its chatRoot shows
// both too. Every iPhone, a folded Duo and a Duo Split View half are narrower than this.
export const chatAlwaysSplit = !isMobile || isTablet
const phoneSplitMinWidth = 700
export const chatSplitsByWidth = isIOS && !isTablet
const splitsAt = (windowWidth: number) => chatAlwaysSplit || (chatSplitsByWidth && windowWidth >= phoneSplitMinWidth)

// Whether chat shows the inbox and conversation side by side right now
export const isChatSplit = (): boolean => splitsAt(chatSplitsByWidth ? Dimensions.get('window').width : 0)
const useFixedSplit = () => chatAlwaysSplit
const useWindowSplit = () => splitsAt(useWindowDimensions().width)
export const useIsChatSplit: () => boolean = chatSplitsByWidth ? useWindowSplit : useFixedSplit
export const chatSplitsAtWidth = splitsAt

// Desktop and iPad register every route in each tab's stack; a phone's tab stacks hold only their
// root screen, with every other route on the root stack above the tabs. Fixed for the app's life.
export const tabStacksHoldEveryRoute = chatAlwaysSplit

// The route that shows the open thread
export const threadRouteName = (): 'chatRoot' | 'chatConversation' =>
  isChatSplit() ? 'chatRoot' : 'chatConversation'
