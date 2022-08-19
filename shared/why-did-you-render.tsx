import React from 'react'
if (__DEV__) {
  console.log('\n\n\nDEBUG: WHY DID YOU RENDER enabled')
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  const ReactRedux = require('react-redux')
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
    ],
    include: [
      /^ConnectFunction/,
      // uncomment to watch everything, realllllly slows things down
      // /.*/,
    ],
    trackAllPureComponents: true,
    trackExtraHooks: [[ReactRedux, 'useSelector']],
  })
}

export {}
