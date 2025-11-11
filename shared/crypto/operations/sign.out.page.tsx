import * as React from 'react'
import {HeaderLeftCancel2, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'

const Screen = React.lazy(async () => {
  const {SignOutput} = await import('./sign')
  return {default: SignOutput}
})

export default {
  getOptions: {
    headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
    headerShown: true,
    needsKeyboard: false,
    title: 'Signed',
  },
  screen: Screen,
}
