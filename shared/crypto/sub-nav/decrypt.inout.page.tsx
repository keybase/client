import * as React from 'react'

const Input = React.lazy(async () => {
  const {DecryptIO} = await import('../operations/decrypt')
  return {default: DecryptIO}
})

export default {screen: Input}
