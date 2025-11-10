import * as React from 'react'

export default {
  getOptions: {title: 'More'},
  screen: React.lazy(async () => import('./root-phone')),
}
