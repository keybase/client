import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'
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
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const onKBFS = incomingShareItems.length
    ? () => {
        dispatch(FsGen.createSetIncomingShareSource({source: incomingShareItems}))
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {index: 0}, selected: 'destinationPicker'}]})
        )
      }
    : undefined
  const onChat = incomingShareItems.length
    ? () => {
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
      }
    : undefined

  return (
    <ChooseTarget
      items={incomingShareItems.map(({payloadPath, type}) => ({
        filename: FsTypes.getLocalPathName(payloadPath),
        shareType: type,
      }))}
      onBack={onBack}
      onChat={onChat}
      onKBFS={onKBFS}
    />
  )
}

export default IOSChooseTarget
