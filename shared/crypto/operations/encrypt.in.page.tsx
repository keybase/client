import * as React from 'react'

const Screen = React.lazy(async () => {
  const {EncryptInput} = await import('./encrypt')
  return {default: EncryptInput}
})

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Encrypt',
  },
  screen: Screen,
}
