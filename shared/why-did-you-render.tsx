/// <reference types="@welldone-software/why-did-you-render" />
// To enable make changes to babel.config.js and ./desktop/webpack.config.babel.js, change `enableWDYR`
import React from 'react'
if (__DEV__) {
  console.log('\n\n\nDEBUG: WHY DID YOU RENDER try to load')
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  console.log('\n\n\nDEBUG: WHY DID YOU RENDER enabled')
  if (whyDidYouRender && typeof whyDidYouRender === 'function') {
    whyDidYouRender(React, {
      // TODO reduce these
      exclude: [
        /Pressable/,
        /Portal/,
        /RNSScreen/,
        /^Screen$/,
        /^Group$/,
        /^View$/,
        /^AnimatedComponentWrapper$/,
        /CardContainer/,
        /StaticContainer/,
        /PressabilityDebugView/,
      ],
      include: [
        // uncomment to watch everything, realllllly slows things down
        /.*/,
      ],
      logOnDifferentValues: false,
      trackAllPureComponents: true,
      // trackExtraHooks: [['useSelector']],
    })
  }
}

export {}
