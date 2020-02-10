import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'
import * as RPCTypes from '../constants/types/rpc-gen'
import ChooseTarget from './choose-target'

const AndroidChooseTarget = () => {
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const url = Container.useSelector(state => state.config.androidShare?.url ?? '')
  const onKBFS = () => {
    dispatch(FsGen.createSetIncomingShareSource({source: FsTypes.stringToLocalPath(url)}))
    dispatch(FsGen.createShowIncomingShare({initialDestinationParentPath: FsTypes.stringToPath('/keybase')}))
  }
  const onChat = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {url}, selected: 'sendAttachmentToChat'}],
      })
    )
  const parts = url.split('/')
  const name = parts[parts.length - 1]

  return (
    <ChooseTarget
      items={[{filename: name, shareType: RPCTypes.IncomingShareType.file}]}
      onBack={onBack}
      onChat={onChat}
      onKBFS={onKBFS}
    />
  )
}

export default AndroidChooseTarget
