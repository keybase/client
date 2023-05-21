import * as React from 'react'

const Email = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Email />
  </React.Suspense>
)

export default {getScreen: () => Screen}
