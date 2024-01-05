import * as React from 'react'

const getOptions = {gesturesEnabled: false}

const Confirm = React.lazy(async () => import('./confirm'))
const Screen = () => (
  <React.Suspense>
    <Confirm />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
