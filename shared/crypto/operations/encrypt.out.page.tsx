import * as React from 'react'

const Screen = React.lazy(async () => {
  const {EncryptOutput} = await import('./encrypt')
  return {default: EncryptOutput}
})

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: false,
    title: 'Encrypted',
  },
  screen: Screen,
}
