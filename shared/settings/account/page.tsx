import * as React from 'react'

const getOptions = {title: 'Your account'}
const Account = React.lazy(async () => import('.'))

const Page = {
  getOptions,
  getScreen: () => Account,
}
export default Page
