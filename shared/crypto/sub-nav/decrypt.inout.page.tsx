import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {DecryptIO} = await import('../operations/decrypt')
    return {default: DecryptIO}
  }),
}
