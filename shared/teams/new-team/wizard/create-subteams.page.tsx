import * as React from 'react'

const CreateSub = React.lazy(async () => import('./create-subteams'))

export default {screen: CreateSub}
