import * as React from 'react'

const Invite = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Invite />
  </React.Suspense>
)

export default {getScreen: () => Screen}
