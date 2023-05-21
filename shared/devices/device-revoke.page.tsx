import * as React from 'react'
import {HeaderLeftCancel} from '../common-adapters/header-hoc'
import type * as Container from '../util/container'

const Revoke = React.lazy(async () => import('./device-revoke'))
type OwnProps = Container.ViewPropsToPageProps<typeof Revoke>

const getOptions = () => ({
  headerLeft: p => <HeaderLeftCancel {...p} />,
  title: '',
})

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Revoke {...p.route.params} />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
