import * as React from 'react'

const ErrorModal = React.lazy(async () => import('./error-modal'))

const getOptions = () => ({
  gesturesEnabled: false,
})

const Screen = () => (
  <React.Suspense>
    <ErrorModal />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
