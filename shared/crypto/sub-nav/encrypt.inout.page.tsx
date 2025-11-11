import * as React from 'react'

const Screen = React.lazy(async () => {
  const {EncryptIO} = await import('../operations/encrypt')
  return {default: EncryptIO}
})

export default {screen: Screen}
