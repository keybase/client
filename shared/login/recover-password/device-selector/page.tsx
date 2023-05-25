import * as React from 'react'

const Selector = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Selector />
  </React.Suspense>
)

export default {getScreen: () => Screen}
