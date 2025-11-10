import * as React from 'react'

const Input = React.lazy(async () => {
  const {VerifyIO} = await import('../operations/verify')
  return {default: VerifyIO}
})

export default {screen: Input}
