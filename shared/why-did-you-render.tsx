import React from 'react'

if (__DEV__) {
  console.log('\n\n\nDEBUG: WHY DID YOU RENDER enabled')
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  const ReactRedux = require('react-redux')
  whyDidYouRender(React, {
    include: [
      /^ConnectFunction/,
      // uncomment to watcy everything, realllllly slows things down
      // /.*/
    ],
    // TODO reduce these
    exclude: [
      /Pressable/,
      /Portal/,
      /RNSScreen/,
      /^Screen$/,
      /^Group$/,
      /^View$/,
      // /CardContainer/,
      // /StaticContainer/,
    ],
    trackAllPureComponents: true,
    trackExtraHooks: [[ReactRedux, 'useSelector']],
  })
}

export {}
