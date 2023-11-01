import * as React from 'react'

const Chat = React.lazy(async () => import('./chat'))

const getOptions = () => ({
  title: 'Chat',
})

const Screen = () => (
  <React.Suspense>
    <Chat />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
