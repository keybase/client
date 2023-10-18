import * as React from 'react'

const Feedback = React.lazy(async () => import('./feedback'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Feedback />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
