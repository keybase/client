import * as React from 'react'

const Known = React.lazy(async () => import('./password-known'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Known />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
