import * as React from 'react'

const Output = React.lazy(async () => {
  const {EncryptOutput} = await import('./encrypt')
  return {default: EncryptOutput}
})

const getOptions = () => ({
  headerShown: true,
  needsKeyboard: false,
  title: 'Encrypt',
})

const Screen = () => (
  <React.Suspense>
    <Output />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
