import * as React from 'react'

const WhatIs = React.lazy(async () => import('.'))

const Screen = () => (
  <React.Suspense>
    <WhatIs />
  </React.Suspense>
)

export default {getScreen: () => Screen}
