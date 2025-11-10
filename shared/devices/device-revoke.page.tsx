import * as React from 'react'
import {HeaderLeftCancel, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import type * as C from '@/constants'

const Revoke = React.lazy(async () => import('./device-revoke'))
type OwnProps = C.ViewPropsToPageProps<typeof Revoke>
export default {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel {...p} />,
    title: '',
  },
  screen: (p: OwnProps) => <Revoke {...p.route.params} />,
}
