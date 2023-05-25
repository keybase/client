import * as React from 'react'
import {HeaderLeftCancel2} from '../../common-adapters/header-hoc'

const Output = React.lazy(async () => {
  const {DecryptOutput} = await import('./decrypt')
  return {default: DecryptOutput}
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
