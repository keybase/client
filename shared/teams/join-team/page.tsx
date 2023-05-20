import * as React from 'react'

const Join = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Join />
  </React.Suspense>
)

export default {getScreen: () => Screen}
