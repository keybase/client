import * as React from 'react'

const Scan = React.lazy(async () => import('./container'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Scan />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
