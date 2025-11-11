import * as React from 'react'
import type * as C from '@/constants'

const DeleteTeam = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof DeleteTeam>

const Screen = (p: OwnProps) => <DeleteTeam {...p.route.params} />

export default {screen: Screen}
