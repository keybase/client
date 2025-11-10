import * as React from 'react'
import type * as C from '@/constants'

const EditTeam = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof EditTeam>

export default {screen: (p: OwnProps) => <EditTeam {...p.route.params} />}
