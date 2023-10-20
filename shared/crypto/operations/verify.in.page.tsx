import * as React from 'react'

const Input = React.lazy(async () => {
  const {VerifyInput} = await import('./verify')
  return {default: VerifyInput}
})

const getOptions = () => ({
  headerShown: true,
  needsKeyboard: true,
  title: 'Verify',
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
