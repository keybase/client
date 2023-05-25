import * as React from 'react'

const Choose = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Choose />
  </React.Suspense>
)

export default {getScreen: () => Screen}
