import * as React from 'react'

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Encrypt',
  },
  screen: React.lazy(async () => {
    const {EncryptInput} = await import('./encrypt')
    return {default: EncryptInput}
  }),
}
