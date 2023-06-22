import * as React from 'react'
// import {HeaderLeftCancel2} from '../../common-adapters/header-hoc'

const Output = React.lazy(async () => {
  const {EncryptOutput} = await import('./encrypt')
  return {default: EncryptOutput}
})

const getOptions = () => ({
  // headerLeft: () => <HeaderLeftCancel2 />,
  headerShown: true,
  needsKeyboard: false,
  title: 'AAAEncrypt',
})

const Screen = () => (
  <React.Suspense>
    <Output />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
