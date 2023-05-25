import * as React from 'react'

const NewTeam = React.lazy(async () => import('./container'))

const Screen = () => (
  <React.Suspense>
    <NewTeam />
  </React.Suspense>
)

export default {getScreen: () => Screen}
