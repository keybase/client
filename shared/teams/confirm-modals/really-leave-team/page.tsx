import * as React from 'react'
import type * as C from '@/constants'

const Leave = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Leave>

const Screen = (p: OwnProps) => <Leave {...p.route.params} />

export default {screen: Screen}
