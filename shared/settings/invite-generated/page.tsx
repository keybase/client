import * as React from 'react'
import type * as C from '@/constants'

const InviteGen = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof InviteGen>

const Screen = (p: OwnProps) => <InviteGen {...p.route.params} />

export default {screen: Screen}
