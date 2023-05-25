import * as React from 'react'

const Logout = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Logout />
  </React.Suspense>
)

export default {getScreen: () => Screen}
