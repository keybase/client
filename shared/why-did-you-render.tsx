import React from 'react'

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  const ReactRedux = require('react-redux')
  whyDidYouRender(React, {
    // TODO reduce these
    exclude: [/Pressable/, /RNSScreen/, /PortalProvider/, /PortalHost/, /Portal/, /CardContainer/],
    trackAllPureComponents: true,
    trackExtraHooks: [[ReactRedux, 'useSelector']],
  })
}
