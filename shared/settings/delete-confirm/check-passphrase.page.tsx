import * as React from 'react'

const CheckPassphrase = React.lazy(async () => import('./check-passphrase'))

const Screen = () => (
  <React.Suspense>
    <CheckPassphrase />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
