import * as React from 'react'

export default {
  screen: React.lazy(async () => {
    const {Phone} = await import('./add-modals')
    return {default: Phone}
  }),
}
