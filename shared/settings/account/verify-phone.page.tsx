import * as React from 'react'

const Screen = React.lazy(async () => {
  const {VerifyPhone} = await import('./add-modals')
  return {default: VerifyPhone}
})

export default {screen: Screen}
