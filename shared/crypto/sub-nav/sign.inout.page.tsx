import * as React from 'react'

const Input = React.lazy(async () => {
  const {SignIO} = await import('../operations/sign')
  return {default: SignIO}
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
