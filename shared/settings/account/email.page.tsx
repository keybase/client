import * as React from 'react'

const Email = React.lazy(async () => {
  const {Email} = await import('./add-modals')
  return {default: Email}
})

const Screen = () => (
  <React.Suspense>
    <Email />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
