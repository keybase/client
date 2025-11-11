import * as React from 'react'
import type * as C from '@/constants'

const OpenTW = React.lazy(async () => import('.'))
type OwnProps = C.ViewPropsToPageProps<typeof OpenTW>

const Screen = (p: OwnProps) => <OpenTW {...p.route.params} />

export default {screen: Screen}
