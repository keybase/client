import * as React from 'react'

const Error = React.lazy(async () => import('./error'))

const getOptions = () => ({
  gesturesEnabled: false,
  headerLeft: null,
})

const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
