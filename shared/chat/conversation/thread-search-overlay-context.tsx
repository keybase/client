import * as React from 'react'
import type {SharedValue} from 'react-native-reanimated'

// Height (in px) of the mobile thread-search bar that overlays the bottom of the
// message list while a search is active. The list reads this to reserve extra
// content padding (so centered/newest messages clear the bar) and to lift the
// jump-to-recent button above it. 0 when no search is active.
export const ThreadSearchOverlayContext = React.createContext<SharedValue<number> | undefined>(undefined)
ThreadSearchOverlayContext.displayName = 'ThreadSearchOverlayContext'
