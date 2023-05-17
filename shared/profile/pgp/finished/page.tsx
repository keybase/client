import * as React from 'react'

const Finished = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Finished />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileFinished: {getScreen}}
