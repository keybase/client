import * as React from 'react'

const Screen = React.lazy(async () => {
  const {SignInput} = await import('./sign')
  return {default: SignInput}
})

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Sign',
  },
  screen: Screen,
}
