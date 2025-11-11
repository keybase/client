import * as React from 'react'
import type * as C from '@/constants'

const Invite = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Invite>

const Screen = (p: OwnProps) => <Invite {...p.route.params} />

export default {screen: Screen}
