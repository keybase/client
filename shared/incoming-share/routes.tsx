import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {defineRouteMap} from '@/constants/types/router'
import {useSafeAreaFrame} from 'react-native-safe-area-context'

const IncomingShareHeaderLeft = () => {
  const clearModals = C.Router2.clearModals
  return (
    <Kb.Text type="BodyBigLink" onClick={clearModals}>
      Cancel
    </Kb.Text>
  )
}

// Content-sized so the native header centers it in the bar; fullWidth would fill
// the asymmetric space between the Cancel pill and the right item and center
// within that instead. maxWidth keeps long filenames clear of both sides — same
// trick as fs/nav-header/ios-header.
export const IncomingShareHeaderTitle = ({title}: {title?: string}) => {
  const {width} = useSafeAreaFrame()
  return (
    <Kb.Box2 direction="vertical" centerChildren={true} style={{maxWidth: width - 240}}>
      {title ? (
        <Kb.Text type="BodyTiny" lineClamp={1}>
          {title}
        </Kb.Text>
      ) : null}
      <Kb.Text type="BodyBig">Share to...</Kb.Text>
    </Kb.Box2>
  )
}

export const newModalRoutes = defineRouteMap({
  incomingShareNew: C.makeScreen(React.lazy(async () => import('.')), {
    getOptions: {
      ...(isIOS
        ? {unstable_headerLeftItems: () => [Kb.nativeCancelHeaderItem(C.Router2.clearModals)]}
        : {headerLeft: () => <IncomingShareHeaderLeft />}),
      headerTitle: () => <IncomingShareHeaderTitle />,
    },
  }),
})
