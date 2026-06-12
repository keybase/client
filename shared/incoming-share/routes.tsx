import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {defineRouteMap} from '@/constants/types/router'

const IncomingShareHeaderLeft = () => {
  const clearModals = C.Router2.clearModals
  return (
    <Kb.Text type="BodyBigLink" onClick={clearModals}>
      Cancel
    </Kb.Text>
  )
}

// Content-sized so the native header centers it in the bar (fullWidth would
// center within the asymmetric space between the left/right items instead)
const IncomingShareHeaderTitle = () => {
  return (
    <Kb.Box2 direction="vertical" centerChildren={true}>
      <Kb.Text type="BodyBig">Share to...</Kb.Text>
    </Kb.Box2>
  )
}

export const newModalRoutes = defineRouteMap({
  incomingShareNew: C.makeScreen(React.lazy(async () => import('.')), {
    getOptions: {
      headerLeft: () => <IncomingShareHeaderLeft />,
      headerTitle: () => <IncomingShareHeaderTitle />,
    },
  }),
})
