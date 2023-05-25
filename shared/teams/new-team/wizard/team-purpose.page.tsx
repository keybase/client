import * as React from 'react'

const Purpose = React.lazy(async () => import('./team-purpose'))

const Screen = () => (
  <React.Suspense>
    <Purpose />
  </React.Suspense>
)

export default {getScreen: () => Screen}
