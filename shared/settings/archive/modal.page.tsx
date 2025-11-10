import * as React from 'react'
import * as C from '@/constants'

const ArchiveModal = React.lazy(async () => import('./modal'))
type OwnProps = C.ViewPropsToPageProps<typeof ArchiveModal>

export default {
  screen: C.featureFlags.archive
    ? (p: OwnProps) => (
        <React.Suspense>
          <ArchiveModal {...p.route.params} />
        </React.Suspense>
      )
    : () => null,
}
