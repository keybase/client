import * as React from 'react'

const Input = React.lazy(async () => {
  const {SignIO} = await import('../operations/sign')
  return {default: SignIO}
})

export default {screen: Input}
