import * as React from 'react'

const Scan = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Scan />
  </React.Suspense>
)

export default {getScreen: () => Screen}
