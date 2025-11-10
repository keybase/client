import * as React from 'react'

const Page = {
  getOptions: {
    headerShown: true,
    needsKeyboard: true,
    title: 'Verify',
  },
  screen: React.lazy(async () => {
    const {VerifyInput} = await import('./verify')
    return {default: VerifyInput}
  }),
}
export default Page
