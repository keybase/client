import * as React from 'react'
import * as C from '@/constants'

const getOptions = {
  header: undefined,
  title: 'Contacts',
}

const Root = React.lazy(async () => import('./manage-contacts'))
const Screen = () =>
  C.isMobile ? (
    <React.Suspense>
      <Root />
    </React.Suspense>
  ) : null

const Page = {getOptions, getScreen: () => Screen}
export default Page
