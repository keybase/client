import * as React from 'react'

export default {
  getOptions: {
    header: undefined,
    title: 'Screen Protector',
  },
  screen: React.lazy(async () => import('./screenprotector')),
}
