import * as React from 'react'

const Scan = React.lazy(async () => import('./container'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null,
  headerTransparent: true,
})

const Screen = () => (
  <React.Suspense>
    <Scan />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
