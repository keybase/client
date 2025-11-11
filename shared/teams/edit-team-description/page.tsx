import * as React from 'react'
import type * as C from '@/constants'

const EditTeam = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof EditTeam>

const Screen = (p: OwnProps) => <EditTeam {...p.route.params} />

export default {screen: Screen}
