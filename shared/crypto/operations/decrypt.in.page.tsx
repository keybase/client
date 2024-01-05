import * as React from 'react'

const getOptions = {
  headerShown: true,
  needsKeyboard: true,
  title: 'Decrypt',
}

const Input = React.lazy(async () => {
  const {DecryptInput} = await import('./decrypt')
  return {default: DecryptInput}
})
const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
