import * as React from 'react'
import type * as C from '@/constants'

const Revoke = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Revoke>

const Screen = (p: OwnProps) => <Revoke {...p.route.params} />

export default {screen: Screen}
