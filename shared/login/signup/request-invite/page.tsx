import * as React from 'react'

const Request = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <Request />
  </React.Suspense>
)

export default {getScreen: () => Screen}
