import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {EncryptIO} = await import('../operations/encrypt')
    return {default: EncryptIO}
  }),
}
