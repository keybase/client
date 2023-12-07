import * as React from 'react'

const Select = React.lazy(async () => import('./select-other-device'))

const getOptions = () => ({})

const Screen = () => (
  <React.Suspense>
    <Select />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
