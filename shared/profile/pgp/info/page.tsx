import * as React from 'react'

const Info = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Info />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileProvideInfo: {getScreen}}
