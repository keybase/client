import * as React from 'react'

const AddContacts = React.lazy(async () => import('./add-contacts'))

const Screen = () => (
  <React.Suspense>
    <AddContacts />
  </React.Suspense>
)

const Page = {getScreen: () => Screen}
export default Page
