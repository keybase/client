import * as React from 'react'
import {HeaderLeftCancel2, type HeaderBackButtonProps} from '@/common-adapters/header-hoc'

const getOptions = {
  headerLeft: (p: HeaderBackButtonProps) => <HeaderLeftCancel2 {...p} />,
  headerShown: true,
  needsKeyboard: false,
  title: 'Signed',
}

const Output = React.lazy(async () => {
  const {SignOutput} = await import('./sign')
  return {default: SignOutput}
})
const Screen = () => (
  <React.Suspense>
    <Output />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
