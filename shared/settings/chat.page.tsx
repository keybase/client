import * as React from 'react'

const getOptions = {title: 'Chat'}

const Chat = React.lazy(async () => import('./chat'))
const Screen = () => (
  <React.Suspense>
    <Chat />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
