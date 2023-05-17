import * as React from 'react'

const Website = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <Website />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileProveWebsiteChoice: {getScreen}}
