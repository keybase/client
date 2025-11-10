import * as React from 'react'

const Input = React.lazy(async () => {
  const {EncryptIO} = await import('../operations/encrypt')
  return {default: EncryptIO}
})

export default {screen: Input}
