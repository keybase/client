import * as React from 'react'
import * as C from '@/constants'

export default {screen: C.isMobile ? React.lazy(async () => import('./push-prompt')) : null}
