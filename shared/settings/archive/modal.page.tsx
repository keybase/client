import * as React from 'react'
import type * as C from '@/constants'

const getOptions = {modal2: true}

const ArchiveModal = React.lazy(async () => import('./modal'))
type OwnProps = C.ViewPropsToPageProps<typeof ArchiveModal>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <ArchiveModal {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
