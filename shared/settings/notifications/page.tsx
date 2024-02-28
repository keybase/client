import * as React from 'react'

const getOptions = {
  title: 'Notifications',
}

const Notif = React.lazy(async () => import('./container'))
const Screen = () => (
  <React.Suspense>
    <Notif />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
