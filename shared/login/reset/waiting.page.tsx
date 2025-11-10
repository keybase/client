import * as React from 'react'
import type * as C from '@/constants'

const Waiting = React.lazy(async () => import('./waiting'))
type OwnProps = C.ViewPropsToPageProps<typeof Waiting>

export default {screen: (p: OwnProps) => <Waiting {...p.route.params} />}
