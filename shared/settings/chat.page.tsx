import * as React from 'react'

export default {
  getOptions: {title: 'Chat'},
  screen: React.lazy(async () => import('./chat')),
}
