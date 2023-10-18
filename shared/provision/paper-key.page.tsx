import * as React from 'react'

const Paper = React.lazy(async () => import('./paper-key'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Paper />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
