import * as React from 'react'
import type * as C from '@/constants'

const UOE = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof UOE>

const Screen = (p: OwnProps) => <UOE {...p.route.params} />

export default {screen: Screen}
