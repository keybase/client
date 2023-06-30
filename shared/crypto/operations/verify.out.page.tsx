import * as React from 'react'
import {HeaderLeftCancel2} from '../../common-adapters/header-hoc'

const Output = React.lazy(async () => {
  const {VerifyOutput} = await import('./verify')
  return {default: VerifyOutput}
})

const getOptions = () => ({
  headerLeft: (p: any) => <HeaderLeftCancel2 {...p} />,
  headerShown: true,
  needsKeyboard: false,
  title: 'Verify',
})

const Screen = () => (
  <React.Suspense>
    <Output />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
