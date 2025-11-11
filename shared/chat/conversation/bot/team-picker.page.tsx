import * as React from 'react'
import type * as C from '@/constants'

const Install = React.lazy(async () => import('./team-picker'))
type OwnProps = C.ViewPropsToPageProps<typeof Install>

const Screen = (p: OwnProps) => <Install {...p.route.params} />

export default {screen: Screen}
