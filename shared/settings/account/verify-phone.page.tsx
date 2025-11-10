import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {VerifyPhone} = await import('./add-modals')
    return {default: VerifyPhone}
  }),
}
