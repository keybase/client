import * as React from 'react'

export default {
  getOptions: {title: 'Notifications'},
  screen: React.lazy(async () => import('./container')),
}
