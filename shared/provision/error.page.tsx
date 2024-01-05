import * as React from 'react'

const getOptions = {modal2: true}

const Error = React.lazy(async () => import('./error'))
const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
