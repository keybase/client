import * as React from 'react'

const getOptions = {gesturesEnabled: false}

const ErrorModal = React.lazy(async () => import('./error-modal'))
const Screen = () => (
  <React.Suspense>
    <ErrorModal />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
