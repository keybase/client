import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {SignIO} = await import('../operations/sign')
    return {default: SignIO}
  }),
}
