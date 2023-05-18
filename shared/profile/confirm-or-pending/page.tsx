import * as React from 'react'

const ConfirmOrPending = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <ConfirmOrPending />
  </React.Suspense>
)

export default {getScreen: () => Screen}
