import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as SettingsConstants from '../constants/settings'
import ChooseTarget from './choose-target'

const IOSChooseTarget = () => {
  const [incomingShareItems, setIncomingShareItems] = React.useState<
    undefined | Array<RPCTypes.IncomingShareItem>
  >(undefined)
  React.useEffect(() => {
    RPCTypes.incomingShareGetIncomingShareItemsRpcPromise().then(items => setIncomingShareItems(items || []))
  }, [])
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createNavigateUp())
  const onKBFS = incomingShareItems?.length
    ? (useOriginal: boolean) => {
        dispatch(FsGen.createSetIncomingShareSource({source: incomingShareItems, useOriginal}))
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})
        )
      }
    : undefined
  const onChat = incomingShareItems?.length
    ? (useOriginal: boolean) => {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {
                props: {incomingShareItems, useOriginal},
                selected: 'sendAttachmentToChat',
              },
            ],
          })
        )
      }
    : undefined

  const erroredSendFeedback =
    incomingShareItems && !incomingShareItems.length
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
      : undefined

  return (
    <ChooseTarget
      items={incomingShareItems || emptyArray}
      erroredSendFeedback={erroredSendFeedback}
      onCancel={onCancel}
      onChat={onChat}
      onKBFS={onKBFS}
    />
  )
}

export default IOSChooseTarget

const emptyArray: Array<RPCTypes.IncomingShareItem> = []
