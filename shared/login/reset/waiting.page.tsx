import * as React from 'react'
import type * as C from '@/constants'

const Waiting = React.lazy(async () => import('./waiting'))
type OwnProps = C.ViewPropsToPageProps<typeof Waiting>

const Screen = (p: OwnProps) => <Waiting {...p.route.params} />

export default {screen: Screen}
