import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useModalHeaderState} from '@/stores/modal-header'
import {OriginalOrCompressedButton} from '.'

const IncomingShareHeaderLeft = () => {
  const onAction = useModalHeaderState(s => s.onAction)
  return (
    <Kb.Text type="BodyBigLink" onClick={onAction}>
      Cancel
    </Kb.Text>
  )
}

const IncomingShareHeaderRight = () => {
  const data = useModalHeaderState(s => s.data)
  const items = data as ReadonlyArray<T.RPCGen.IncomingShareItem> | undefined
  if (!items?.length) return null
  return <OriginalOrCompressedButton incomingShareItems={items} />
}

const IncomingShareHeaderTitle = () => {
  const title = useModalHeaderState(s => s.title)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
      {title ? (
        <Kb.Text type="BodyTiny" lineClamp={1}>
          {title}
        </Kb.Text>
      ) : null}
      <Kb.Text type="BodyBig">Share to...</Kb.Text>
    </Kb.Box2>
  )
}

export const newModalRoutes = {
  incomingShareNew: C.makeScreen(React.lazy(async () => import('.')), {
    getOptions: {
      headerLeft: () => <IncomingShareHeaderLeft />,
      headerRight: () => <IncomingShareHeaderRight />,
      headerTitle: () => <IncomingShareHeaderTitle />,
    },
  }),
}
