import * as React from 'react'
import type * as C from '@/constants'

const TeamInfo = React.lazy(async () => import('./team-info'))
type OwnProps = C.ViewPropsToPageProps<typeof TeamInfo>

const Screen = (p: OwnProps) => <TeamInfo {...p.route.params} />

export default {screen: Screen}
