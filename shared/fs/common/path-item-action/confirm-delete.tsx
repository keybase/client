import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as C from '@/constants'
import * as FS from '@/stores/fs'
import {makeUUID} from '@/util/uuid'
import {useFsErrorActionOrThrow} from '../error-state'

export type Props = {
  onBack: () => void
  onDelete: () => void
  path: T.FS.Path
  title: string
}

const ReallyDeleteFile = (props: Props) =>
  props.path ? (
    <Kb.ConfirmModal
      confirmText="Yes, delete"
      description="It will be deleted for everyone. This cannot be undone."
      header={<Kb.Icon type="iconfont-trash" sizeType="Big" color={Kb.Styles.globalColors.red} />}
      onCancel={props.onBack}
      onConfirm={props.onDelete}
      prompt={`Are you sure you want to delete "${T.FS.getPathName(props.path)}"?`}
    />
  ) : null

type OwnProps = {
  path: T.FS.Path
  mode: 'row' | 'screen'
}

const Container = (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const navigateUp = C.Router2.navigateUp
  const onBack = navigateUp
  const onDelete = () => {
    if (path !== FS.defaultPath) {
      const f = async () => {
        const opID = makeUUID()
        try {
          await T.RPCGen.SimpleFSSimpleFSRemoveRpcPromise({
            opID,
            path: FS.pathToRPCPath(path),
            recursive: true,
          })
          await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID})
        } catch (error) {
          errorToActionOrThrow(error, path)
        }
      }
      C.ignorePromise(f())
    }
    // If this is a screen menu, then we're deleting the folder we're in,
    // and we need to navigate up twice.
    if (mode === 'screen') {
      navigateUp()
      navigateUp()
    } else {
      navigateUp()
    }
  }
  const props = {
    onBack,
    onDelete,
    path,
    title: 'Confirmation',
  }
  return <ReallyDeleteFile {...props} />
}

export default Container
