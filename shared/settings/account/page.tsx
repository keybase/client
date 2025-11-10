import * as React from 'react'

export default {
  getOptions: {title: 'Your account'},
  screen: React.lazy(async () => import('.')),
}
