import * as React from 'react'
import type * as C from '@/constants'

const AddEmail = React.lazy(async () => import('./add-email'))
type OwnProps = C.ViewPropsToPageProps<typeof AddEmail>

const Screen = (p: OwnProps) => <AddEmail {...p.route.params} />

export default {screen: Screen}
