import * as React from 'react'

const AddSubMem = React.lazy(async () => import('./add-subteam-members'))

const Screen = () => (
  <React.Suspense>
    <AddSubMem />
  </React.Suspense>
)

export default {getScreen: () => Screen}
