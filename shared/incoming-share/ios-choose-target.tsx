import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as SettingsConstants from '../constants/settings'
import useRPC from '../util/use-rpc'
import ChooseTarget from './choose-target'

const isChatOnly = (items?: Array<RPCTypes.IncomingShareItem>): boolean =>
  items?.length === 1 &&
  items[0].type === RPCTypes.IncomingShareType.text &&
  !!items[0].content &&
  !items[0].originalPath

const useNextActions = (
  incomingShareItems: Array<RPCTypes.IncomingShareItem>,
  error?: any
): {
  erroredSendFeedback?: () => void
  onCancel: () => void
  onChat?: (useOriginal: boolean) => void
  onKBFS?: (useOriginal: boolean) => void
} => {
  const dispatch = Container.useDispatch()
  const onCancel = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const erroredSendFeedback = React.useMemo(
    () =>
      error
        ? () => {
            dispatch(RouteTreeGen.createClearModals())
            dispatch(
              RouteTreeGen.createNavigateAppend({
                path: [
                  {
                    props: {feedback: `iOS share failure`},
                    selected: SettingsConstants.feedbackTab,
                  },
                ],
              })
            )
          }
        : undefined,
    [error, dispatch]
  )
  const onChatOnly = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {incomingShareItems},
            selected: 'sendAttachmentToChat',
          },
        ],
      })
    )
  }, [dispatch, incomingShareItems])

  const onChatSelectable = React.useCallback(
    (useOriginal: boolean) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {canBack: true, incomingShareItems, useOriginal},
              selected: 'sendAttachmentToChat',
            },
          ],
        })
      )
    },
    [dispatch, incomingShareItems]
  )

  const onKBFSSelectable = React.useCallback(
    (useOriginal: boolean) => {
      dispatch(FsGen.createSetIncomingShareSource({source: incomingShareItems, useOriginal}))
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})
      )
    },
    [dispatch, incomingShareItems]
  )

  if (!incomingShareItems.length) {
    return {erroredSendFeedback, onCancel}
  }

  if (isChatOnly(incomingShareItems)) {
    return {erroredSendFeedback, onCancel, onChat: onChatOnly}
  }

  return {erroredSendFeedback, onCancel, onChat: onChatSelectable, onKBFS: onKBFSSelectable}
}

const IOSChooseTarget = () => {
  const [incomingShareItems, setIncomingShareItems] = React.useState<Array<RPCTypes.IncomingShareItem>>([])
  const [incomingShareError, setIncomingShareError] = React.useState<any>(undefined)

  const rpc = useRPC(RPCTypes.incomingShareGetIncomingShareItemsRpcPromise)
  const getIncomingShareItems = React.useCallback(() => {
    rpc(
      [undefined],
      items => setIncomingShareItems(items || []),
      err => setIncomingShareError(err)
    )
  }, [rpc, setIncomingShareError, setIncomingShareItems])
  React.useEffect(getIncomingShareItems, [getIncomingShareItems])

  const {erroredSendFeedback, onCancel, onChat, onKBFS} = useNextActions(
    incomingShareItems,
    incomingShareError
  )

  return (
    <ChooseTarget
      items={incomingShareItems}
      erroredSendFeedback={erroredSendFeedback}
      onCancel={onCancel}
      onChat={onChat}
      onKBFS={onKBFS}
    />
  )
}

export default IOSChooseTarget
