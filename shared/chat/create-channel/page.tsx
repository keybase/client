import * as React from 'react'
import type * as C from '@/constants'

const Channel = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Channel>

export default {screen: (p: OwnProps) => <Channel {...p.route.params} />}
