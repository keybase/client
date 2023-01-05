/// <reference types="@welldone-software/why-did-you-render" />
// To enable make changes to babel.config.js and ./desktop/webpack.config.babel.js, change `enableWDYR`
// import React from 'react'
// if (__DEV__) {
//   console.log('\n\n\nDEBUG: WHY DID YOU RENDER try to load')
//   const whyDidYouRender = require('@welldone-software/why-did-you-render')
//   console.log('\n\n\nDEBUG: WHY DID YOU RENDER enabled')
//   if (whyDidYouRender && typeof whyDidYouRender === 'function') {
//     const ush = require('./util/use-selector').default
//     whyDidYouRender(React, {
//       // TODO reduce these
//       exclude: [
//         /Pressable/,
//         /Portal/,
//         /RNSScreen/,
//         /^Screen$/,
//         /^Group$/,
//         /^View$/,
//         /^AnimatedComponentWrapper$/,
//         /CardContainer/,
//         /StaticContainer/,
//       ],
//       include: [
//         /^ConnectFunction/,
//         // uncomment to watch everything, realllllly slows things down
//         // /.*/,
//       ],
//       // logOnDifferentValues: true,
//       trackAllPureComponents: true,
//       trackExtraHooks: [[ush, 'useSelector']],
//     })
//   }
// }

export {}
