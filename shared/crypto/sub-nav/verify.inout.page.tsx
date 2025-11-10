import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {VerifyIO} = await import('../operations/verify')
    return {default: VerifyIO}
  }),
}
