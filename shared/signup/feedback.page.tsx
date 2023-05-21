import * as React from 'react'

const Feedback = React.lazy(async () => import('./feedback'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null,
  headerRightActions: null,
})

const Screen = () => (
  <React.Suspense>
    <Feedback />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
