import * as React from 'react'

const Screen = React.lazy(async () => {
  const {VerifyInput} = await import('./verify')
  return {default: VerifyInput}
})

export default {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Verify',
  },
  screen: Screen,
}
