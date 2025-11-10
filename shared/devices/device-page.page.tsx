import * as React from 'react'
import type * as C from '@/constants'

type OwnProps = C.ViewPropsToPageProps<typeof Device>
const Device = React.lazy(async () => import('./device-page'))

export default {getOptions: {title: ''}, screen: (p: OwnProps) => <Device {...p.route.params} />}
