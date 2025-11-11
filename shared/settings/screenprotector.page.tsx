import * as React from 'react'

const Screen = React.lazy(async () => import('./screenprotector'))

export default {
  getOptions: {
    header: undefined,
    title: 'Screen Protector',
  },
  screen: Screen,
}
