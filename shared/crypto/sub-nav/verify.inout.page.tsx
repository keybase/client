import * as React from 'react'

const Screen = React.lazy(async () => {
  const {VerifyIO} = await import('../operations/verify')
  return {default: VerifyIO}
})

export default {screen: Screen}
