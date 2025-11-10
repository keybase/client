import * as React from 'react'
import type * as C from '@/constants'

const AddEmoji = React.lazy(async () => import('./add-emoji'))
type OwnProps = C.ViewPropsToPageProps<typeof AddEmoji>

export default {screen: (p: OwnProps) => <AddEmoji {...p.route.params} />}
