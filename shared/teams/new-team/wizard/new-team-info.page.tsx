import * as React from 'react'

const Info = React.lazy(async () => import('./new-team-info'))

const Screen = () => (
  <React.Suspense>
    <Info />
  </React.Suspense>
)

export default {getScreen: () => Screen}
