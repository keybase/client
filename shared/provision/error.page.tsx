import * as React from 'react'

const Error = React.lazy(async () => import('./error'))

const getOptions = () => ({
  modal2: true,
})

const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
