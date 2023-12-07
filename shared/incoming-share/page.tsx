import * as React from 'react'

const IncomingShare = React.lazy(async () => import('.'))

const Screen = () => {
  return (
    <React.Suspense>
      <IncomingShare />
    </React.Suspense>
  )
}

const Page = {getScreen: () => Screen}
export default Page
