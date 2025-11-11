import * as React from 'react'

const Screen = React.lazy(async () => import('./root-desktop-tablet'))

export default {
  getOptions: {title: 'Settings'},
  screen: Screen,
}
