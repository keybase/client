import * as React from 'react'

const AddSubMem = React.lazy(async () => import('./add-subteam-members'))

export default {screen: AddSubMem}
