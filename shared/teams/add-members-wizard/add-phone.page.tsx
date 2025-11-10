import * as React from 'react'

const AddPhone = React.lazy(async () => import('./add-phone'))

export default {screen: AddPhone}
