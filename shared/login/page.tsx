import * as React from 'react'

const Root = React.lazy(async () => import('.'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Root />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
