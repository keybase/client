/// <reference types="@welldone-software/why-did-you-render" />
import enabled from './why-did-you-render-enabled'
import * as React from 'react'
if (enabled && __DEV__) {
  console.log('\n\n\nDEBUG: WHY DID YOU RENDER try to load')
  const whyDidYouRender = require('@welldone-software/why-did-you-render') as
    | undefined
    | ((r: unknown, o: unknown) => void)
  console.log('\n\n\nDEBUG: WHY DID YOU RENDER enabled')
  if (whyDidYouRender && typeof whyDidYouRender === 'function') {
    whyDidYouRender(React, {
      // TODO reduce these
      exclude: [
        /^Pressable$/,
        /^Portal$/,
        /^RNSScreen$/,
        /^Screen$/,
        /^Group$/,
        /^View$/,
        /^AnimatedComponentWrapper$/,
        /^CardContainer$/,
        /^StaticContainer$/,
        /^PressabilityDebugView$/,
        /^PreventRemoveProvider$/,
        /^NativeStackViewInner$/,
        /^LeftTabNavigator/,
        /^RouteBox/,
      ],
      include: [
        // uncomment to watch everything, realllllly slows things down
        // /.*/,
      ],
      // logOnDifferentValues: false,
      trackAllPureComponents: true,
    })
  }
}

export {}
