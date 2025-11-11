import * as React from 'react'

const Screen = React.lazy(async () => import('./chat'))

export default {
  getOptions: {title: 'Chat'},
  screen: Screen,
}
