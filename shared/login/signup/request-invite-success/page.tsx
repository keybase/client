import * as React from 'react'

const Success = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Success />
  </React.Suspense>
)

export default {getScreen: () => Screen}
