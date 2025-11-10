import * as React from 'react'
import type * as C from '@/constants'

const AddEmail = React.lazy(async () => import('./add-email'))
type OwnProps = C.ViewPropsToPageProps<typeof AddEmail>

export default {screen: (p: OwnProps) => <AddEmail {...p.route.params} />}
