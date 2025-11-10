import * as React from 'react'
import type * as C from '@/constants'

const DeleteTeam = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof DeleteTeam>

export default {screen: (p: OwnProps) => <DeleteTeam {...p.route.params} />}
