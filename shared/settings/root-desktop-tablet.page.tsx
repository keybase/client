import * as React from 'react'

export default {
  getOptions: {title: 'Settings'},
  screen: React.lazy(async () => import('./root-desktop-tablet')),
}
