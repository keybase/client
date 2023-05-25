import * as React from 'react'

const PWD = React.lazy(async () => import('./password'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <PWD />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
