import * as React from 'react'

const Account = React.lazy(async () => import('.'))

const getOptions = () => ({
  header: undefined,
  title: 'Your account',
})

const Screen = () => (
  <React.Suspense>
    <Account />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
