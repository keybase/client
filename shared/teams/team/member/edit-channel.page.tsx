import * as React from 'react'
import type * as C from '@/constants'

const EditChannel = React.lazy(async () => import('./edit-channel'))
type OwnProps = C.ViewPropsToPageProps<typeof EditChannel>

const Screen = (p: OwnProps) => <EditChannel {...p.route.params} />

export default {screen: Screen}
