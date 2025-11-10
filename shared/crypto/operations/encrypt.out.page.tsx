import * as React from 'react'

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: false,
    title: 'Encrypted',
  },

  screen: React.lazy(async () => {
    const {EncryptOutput} = await import('./encrypt')
    return {default: EncryptOutput}
  }),
}
