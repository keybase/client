import * as React from 'react'

const Paper = React.lazy(async () => import('./paper-key'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Paper />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
