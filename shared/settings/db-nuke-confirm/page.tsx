import * as React from 'react'

const Nuke = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Nuke />
  </React.Suspense>
)

export default {getScreen: () => Screen}
