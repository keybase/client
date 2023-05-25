import * as React from 'react'

const Input = React.lazy(async () => {
  const {DecryptInput} = await import('./decrypt')
  return {default: DecryptInput}
})

const getOptions = () => ({
  headerShown: true,
  needsKeyboard: true,
  title: 'Decrypt',
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
