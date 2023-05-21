import * as React from 'react'

const PaperKey = React.lazy(async () => import('./enter-paper-key'))

const Screen = () => (
  <React.Suspense>
    <PaperKey />
  </React.Suspense>
)

export default {getScreen: () => Screen}
