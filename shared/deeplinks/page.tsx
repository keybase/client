import * as React from 'react'

const Error = React.lazy(async () => import('./error'))

const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

export default {getScreen: () => Screen}
