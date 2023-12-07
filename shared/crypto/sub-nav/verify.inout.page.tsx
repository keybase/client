import * as React from 'react'

const Input = React.lazy(async () => {
  const {VerifyIO} = await import('../operations/verify')
  return {default: VerifyIO}
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
