import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {Email} = await import('./add-modals')
    return {default: Email}
  }),
}
