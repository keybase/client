import * as React from 'react'
import {HeaderLeftCancel, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import type * as C from '@/constants'

const Revoke = React.lazy(async () => import('./device-revoke'))
type OwnProps = C.ViewPropsToPageProps<typeof Revoke>

const getOptions = () => ({
  headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel {...p} />,
  title: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Revoke {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
