import * as React from 'react'

const CreateChan = React.lazy(async () => import('./create-channels'))

export default {screen: CreateChan}
