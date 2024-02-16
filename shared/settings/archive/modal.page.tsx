import * as React from 'react'
import * as C from '@/constants'

const getOptions = {}

const ArchiveModal = React.lazy(async () => import('./modal'))
type OwnProps = C.ViewPropsToPageProps<typeof ArchiveModal>

const Screen = C.featureFlags.archive
  ? (p: OwnProps) => (
      <React.Suspense>
        <ArchiveModal {...p.route.params} />
      </React.Suspense>
    )
  : () => null

const Page = {getOptions, getScreen: () => Screen}
export default Page
