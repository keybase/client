import * as React from 'react'

const Generate = React.lazy(async () => import('.'))
const Screen = () => (
  <React.Suspense>
    <Generate />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileGenerate: {getScreen}}
