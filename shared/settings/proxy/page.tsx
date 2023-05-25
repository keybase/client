import * as React from 'react'

const Proxy = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Proxy />
  </React.Suspense>
)

export default {getScreen: () => Screen}
