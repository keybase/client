import * as React from 'react'
import type * as C from '@/constants'

const Leave = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Leave>

export default {screen: (p: OwnProps) => <Leave {...p.route.params} />}
