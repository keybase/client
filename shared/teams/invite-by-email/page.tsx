import * as React from 'react'
import type * as C from '@/constants'

const Invite = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Invite>

export default {screen: (p: OwnProps) => <Invite {...p.route.params} />}
