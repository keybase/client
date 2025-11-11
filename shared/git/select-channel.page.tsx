import * as React from 'react'
import type * as C from '@/constants'

const Select = React.lazy(async () => import('./select-channel'))
type OwnProps = C.ViewPropsToPageProps<typeof Select>

const Screen = (p: OwnProps) => <Select {...p.route.params} />

export default {screen: Screen}
