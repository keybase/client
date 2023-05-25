import * as React from 'react'

const Phone = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Phone />
  </React.Suspense>
)

export default {getScreen: () => Screen}
