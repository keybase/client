import * as React from 'react'

const Screen = React.lazy(async () => import('./paper-key'))

export default {
  getOptions: {
    gesturesEnabled: false,
    modal2: true,
    modal2NoClose: true,
  },
  screen: Screen,
}
