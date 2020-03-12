import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import ChooseTarget from './choose-target'

const IOSChooseTarget = () => {
  const [incomingShareItems, setIncomingShareItems] = React.useState<Array<RPCTypes.IncomingShareItem>>([])
  React.useEffect(() => {
    RPCTypes.incomingShareGetIncomingShareItemsRpcPromise().then(
      items => items && setIncomingShareItems(items)
    )
  }, [])
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createNavigateUp())
  const onKBFS = incomingShareItems.length
    ? (useOriginal: boolean) => {
        dispatch(FsGen.createSetIncomingShareSource({source: incomingShareItems, useOriginal}))
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})
        )
      }
    : undefined
  const onChat = incomingShareItems.length
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

  return <ChooseTarget items={incomingShareItems} onCancel={onCancel} onChat={onChat} onKBFS={onKBFS} />
}

export default IOSChooseTarget
