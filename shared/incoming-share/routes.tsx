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

const IncomingShareHeaderTitle = () => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
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
