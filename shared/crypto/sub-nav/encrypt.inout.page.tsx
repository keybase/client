import * as React from 'react'

const Input = React.lazy(async () => {
  const {EncryptIO} = await import('../operations/encrypt')
  return {default: EncryptIO}
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
