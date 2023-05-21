import * as React from 'react'

const Input = React.lazy(async () => {
  const {SignInput} = await import('./sign')
  return {default: SignInput}
})

const getOptions = () => ({
  headerShown: true,
  needsKeyboard: true,
  title: 'Sign',
})

const Screen = () => (
  <React.Suspense>
    <Input />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
