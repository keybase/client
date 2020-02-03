import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as FsGen from '../actions/fs-gen'
import * as FsTypes from '../constants/types/fs'

const AndroidChooseTarget = () => {
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
  const url = Container.useSelector(state => state.config.androidShare.url)
  const onKBFS = () => {
    dispatch(FsGen.createSetIncomingShareLocalPath({localPath: FsTypes.stringToLocalPath(url)}))
    dispatch(FsGen.createShowIncomingShare({initialDestinationParentPath: FsTypes.stringToPath('/keybase')}))
  }
  const onChat = () =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {url}, selected: 'sendAttachmentToChat'}]}))
  const parts = url.split('/')
  const name = parts[parts.lenght - 1]

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader onBack={onBack} title="Incoming file" />
      <Kb.Box2
        direction="vertical"
        gap="small"
        fullWidth={true}
        gapStart={true}
        style={styles.container}
        alignItems="center"
      >
        <>
          <Kb.Text type="Body">Where would you like to send this incoming file?</Kb.Text>
          <Kb.Text type="Body">{name}</Kb.Text>
        </>
        <Kb.ButtonBar>
          <Kb.Button mode="Primary" label="Chat" onClick={onChat} />
          <Kb.Button mode="Secondary" label="KBFS" onClick={onKBFS} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {flexGrow: 1},
}))

export default AndroidChooseTarget
