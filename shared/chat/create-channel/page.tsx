import * as React from 'react'
import type * as C from '@/constants'

const Channel = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Channel>

const Screen = (p: OwnProps) => <Channel {...p.route.params} />

export default {screen: Screen}
