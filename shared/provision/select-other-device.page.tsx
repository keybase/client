import * as React from 'react'

const Select = React.lazy(async () => import('./select-other-device'))

export default {screen: Select}
