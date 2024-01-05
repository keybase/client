import * as React from 'react'

const getOptions = {
  headerShown: true,
  needsKeyboard: true,
  title: 'Sign',
}

const Input = React.lazy(async () => {
  const {SignInput} = await import('./sign')
  return {default: SignInput}
})
const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
