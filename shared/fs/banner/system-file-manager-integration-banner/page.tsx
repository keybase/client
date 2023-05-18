import * as React from 'react'

const Perms = React.lazy(async () => import('./kext-permission-popup-container'))

const Screen = () => (
  <React.Suspense>
    <Perms />
  </React.Suspense>
)

export default {getScreen: () => Screen}
