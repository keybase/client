import * as React from 'react'

const AddContacts = React.lazy(async () => import('./add-contacts'))

export default {screen: AddContacts}
