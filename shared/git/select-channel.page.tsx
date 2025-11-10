import * as React from 'react'
import type * as C from '@/constants'

const Select = React.lazy(async () => import('./select-channel'))
type OwnProps = C.ViewPropsToPageProps<typeof Select>

export default {screen: (p: OwnProps) => <Select {...p.route.params} />}
