import * as React from 'react'

const EditProfile = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <EditProfile />
  </React.Suspense>
)

export default {getScreen: () => Screen}
