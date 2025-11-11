import * as React from 'react'
import type * as C from '@/constants'

const CreateChan = React.lazy(async () => import('./create-channels'))
type OwnProps = C.ViewPropsToPageProps<typeof CreateChan>

const Screen = (p: OwnProps) => <CreateChan {...p.route.params} />

export default {screen: Screen}
