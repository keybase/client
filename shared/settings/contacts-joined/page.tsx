import * as React from 'react'

const Joined = React.lazy(async () => import('.'))

const Screen = () => (
  <React.Suspense>
    <Joined />
  </React.Suspense>
)

export default {getScreen: () => Screen}
