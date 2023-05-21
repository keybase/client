import * as React from 'react'

const AddContacts = React.lazy(async () => import('./add-contacts'))

const Screen = () => (
  <React.Suspense>
    <AddContacts />
  </React.Suspense>
)

export default {getScreen: () => Screen}
