import * as React from 'react'
import {HeaderLeftCancel2, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'

const Screen = React.lazy(async () => {
  const {VerifyOutput} = await import('./verify')
  return {default: VerifyOutput}
})

export default {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
    headerShown: true,
    needsKeyboard: false,
    title: 'Verified',
  },
  screen: Screen,
}
