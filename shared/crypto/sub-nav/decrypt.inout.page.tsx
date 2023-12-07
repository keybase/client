import * as React from 'react'

const Input = React.lazy(async () => {
  const {DecryptIO} = await import('../operations/decrypt')
  return {default: DecryptIO}
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
