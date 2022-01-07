import React from 'react'

if (process.env.NODE_ENV === 'development') {
  console.log('\n\n\nWHY DID YOU RENDER ON')
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  const ReactRedux = require('react-redux')
  whyDidYouRender(React, {
    // TODO reduce these
    exclude: [
      /Pressable/,
      /RNSScreen/,
      /PortalProvider/,
      /PortalHost/,
      /Portal/,
      /CardContainer/,
      /StaticContainer/,
    ],
    trackAllPureComponents: true,
    trackExtraHooks: [[ReactRedux, 'useSelector']],
  })
}
