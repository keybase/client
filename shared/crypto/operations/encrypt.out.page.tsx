import * as React from 'react'

const getOptions = {
  headerShown: true,
  needsKeyboard: false,
  title: 'Encrypted',
}

const Output = React.lazy(async () => {
  const {EncryptOutput} = await import('./encrypt')
  return {default: EncryptOutput}
})
const Screen = () => (
  <React.Suspense>
    <Output />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
