import * as React from 'react'

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Decrypt',
  },
  screen: React.lazy(async () => {
    const {DecryptInput} = await import('./decrypt')
    return {default: DecryptInput}
  }),
}
