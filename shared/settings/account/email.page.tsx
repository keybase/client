import * as React from 'react'

const Screen = React.lazy(async () => {
  const {Email} = await import('./add-modals')
  return {default: Email}
})

export default {screen: Screen}
