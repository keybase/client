import * as React from 'react'
import * as DarkMode from '../constants/darkmode'

// Individual components can then call Styles.isDarkMode() to get the value. Problem is they need to know that
// that value has changed.
// To solve this at the router level we increment the navKey to cause an entire redraw. This is very
// overkill and causes state to be lost (scroll etc).
// Our Styles.styleSheetCreate takes a function which is called so we can grab the values in both dark and light
// contexts. We have light/dark colors in styles/colors. So to most components that just use a color, they can
// just use a 'magic' color which has two versions.
//
// Now some peculiarities:
// ios: ios actually has native support for the 'magic' colors so we use that. This means we actually don't
// do the navKey thing so we can maintain state and you get native blending when the switch happens.
// But as a side effect if you call isDarkMode() you never know if that changes and you're not redrawn
// so you can get out of sync. The solution to this is to use the Styles.DarkModeContext but that was
// just added.
// One additional note. The animation system does not work with the magic colors so that code will use
// the explicit colors/darkColors and not this magic wrapper
//

export const isDarkMode = () => DarkMode.useDarkModeState.getState().isDarkMode()
export const DarkModeContext = React.createContext(isDarkMode())
