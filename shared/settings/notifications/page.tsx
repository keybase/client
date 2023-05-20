import * as React from 'react'

const Notif = React.lazy(async () => import('./container'))

export const getOptions = () => ({
  header: undefined,
  title: 'Notifications',
})

const Screen = () => (
  <React.Suspense>
    <Notif />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
