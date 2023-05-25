import * as React from 'react'

const Password = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Password />
  </React.Suspense>
)

export default {getScreen: () => Screen}
