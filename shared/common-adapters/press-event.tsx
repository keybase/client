import type * as React from 'react'
import type {GestureResponderEvent} from 'react-native'

// RN's press event type isn't assignable to React.BaseSyntheticEvent (bubbles/cancelable are
// typed as possibly undefined), but at runtime it is a synthetic event with the same methods,
// so cross-platform onClick handlers typed with BaseSyntheticEvent can take it.
export const asSyntheticEvent = (e: GestureResponderEvent) => e as unknown as React.BaseSyntheticEvent
