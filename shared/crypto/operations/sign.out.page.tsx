import * as React from 'react'
import {HeaderLeftCancel2} from '../../common-adapters/header-hoc'

const Output = React.lazy(async () => {
  const {SignOutput} = await import('./sign')
  return {default: SignOutput}
})

const getOptions = () => ({
  headerLeft: p => <HeaderLeftCancel2 {...p} />,
  headerShown: true,
  needsKeyboard: false,
  title: 'Decrypt',
})

const Screen = () => (
  <React.Suspense>
    <Output />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
