import * as React from 'react'

const Name = React.lazy(async () => import('./set-public-name'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Name />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
