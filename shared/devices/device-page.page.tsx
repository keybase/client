import * as React from 'react'
import type * as C from '@/constants'

const Device = React.lazy(async () => import('./device-page'))
type OwnProps = C.ViewPropsToPageProps<typeof Device>

const Screen = (p: OwnProps) => <Device {...p.route.params} />

export default {getOptions: {title: ''}, screen: Screen}
