import * as React from 'react'

const Invites = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Invites />
  </React.Suspense>
)

export default {getScreen: () => Screen}
