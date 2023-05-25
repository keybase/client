import * as React from 'react'

const Root = React.lazy(async () => import('./root-desktop-tablet'))

const getOptions = () => ({
  title: 'Settings',
})

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen, skipShim: true}
