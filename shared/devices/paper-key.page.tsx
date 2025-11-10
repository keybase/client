import * as React from 'react'

export default {
  getOptions: {
    gesturesEnabled: false,
    modal2: true,
    modal2NoClose: true,
  },
  screen: React.lazy(async () => import('./paper-key')),
}
