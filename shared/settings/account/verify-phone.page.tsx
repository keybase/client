import * as React from 'react'

const VerifyPhone = React.lazy(async () => {
  const {VerifyPhone} = await import('./add-modals')
  return {default: VerifyPhone}
})

const Screen = () => (
  <React.Suspense>
    <VerifyPhone />
  </React.Suspense>
)

export default {getScreen: () => Screen}
