import * as React from 'react'

const Select = React.lazy(async () => import('./select-other-device'))
const Screen = () => (
  <React.Suspense>
    <Select />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
