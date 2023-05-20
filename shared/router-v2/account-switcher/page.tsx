import * as React from 'react'

const Switcher = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Switcher />
  </React.Suspense>
)

export default {getScreen: () => Screen}
