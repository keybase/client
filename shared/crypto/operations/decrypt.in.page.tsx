import * as React from 'react'

const Screen = React.lazy(async () => {
  const {DecryptInput} = await import('./decrypt')
  return {default: DecryptInput}
})

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Decrypt',
  },
  screen: Screen,
}
