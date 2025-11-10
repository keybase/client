import * as React from 'react'

const ErrorModal = React.lazy(async () => import('./error-modal'))

export default {getOptions: {gesturesEnabled: false}, screen: ErrorModal}
