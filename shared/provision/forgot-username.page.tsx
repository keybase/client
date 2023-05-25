import * as React from 'react'

const Forgot = React.lazy(async () => import('./forgot-username'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Forgot />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
