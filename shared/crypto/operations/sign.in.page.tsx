import * as React from 'react'

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Sign',
  },
  screen: React.lazy(async () => {
    const {SignInput} = await import('./sign')
    return {default: SignInput}
  }),
}
