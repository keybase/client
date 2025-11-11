import * as React from 'react'

const Screen = React.lazy(async () => import('./root-phone'))

export default {
  getOptions: {title: 'More'},
  screen: Screen,
}
