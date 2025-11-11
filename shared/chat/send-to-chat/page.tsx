import * as React from 'react'
import type * as C from '@/constants'

const Send = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof Send>

const Screen = (p: OwnProps) => <Send {...p.route.params} />

export default {screen: Screen}
