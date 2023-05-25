import * as React from 'react'

const Enter = React.lazy(async () => import('./password-enter'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
})

const Screen = () => (
  <React.Suspense>
    <Enter />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
