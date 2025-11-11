import * as React from 'react'

const Screen = React.lazy(async () => {
  const {Phone} = await import('./add-modals')
  return {default: Phone}
})

export default {screen: Screen}
