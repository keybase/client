import * as React from 'react'

const Phone = React.lazy(async () => {
  const {Phone} = await import('./add-modals')
  return {default: Phone}
})

const Screen = () => (
  <React.Suspense>
    <Phone />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
