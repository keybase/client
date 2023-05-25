import * as React from 'react'

const Big = React.lazy(async () => import('./make-big-team'))

const Screen = () => (
  <React.Suspense>
    <Big />
  </React.Suspense>
)

export default {getScreen: () => Screen}
