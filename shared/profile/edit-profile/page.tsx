import * as React from 'react'

const EditProfile = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <EditProfile />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileEdit: {getScreen}}
