import * as React from 'react'

const Input = React.lazy(async () => {
  const {EncryptInput} = await import('./encrypt')
  return {default: EncryptInput}
})

const getOptions = () => ({
  headerShown: true,
  needsKeyboard: true,
  title: 'Encrypt',
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
