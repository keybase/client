import * as React from 'react'

const getOptions = {
  headerShown: true,
  needsKeyboard: true,
  title: 'Encrypt',
}

const Input = React.lazy(async () => {
  const {EncryptInput} = await import('./encrypt')
  return {default: EncryptInput}
})
const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
