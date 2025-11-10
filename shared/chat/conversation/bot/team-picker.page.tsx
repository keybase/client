import * as React from 'react'
import type * as C from '@/constants'

const Install = React.lazy(async () => import('./team-picker'))
type OwnProps = C.ViewPropsToPageProps<typeof Install>

export default {screen: (p: OwnProps) => <Install {...p.route.params} />}
