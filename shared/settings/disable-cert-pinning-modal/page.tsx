import * as React from 'react'

const Disable = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Disable />
  </React.Suspense>
)

export default {getScreen: () => Screen}
