import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as C from '@/constants'
import * as React from 'react'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

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
  const deleteFile = useFSState(s => s.dispatch.deleteFile)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = navigateUp
  const onDelete = React.useCallback(() => {
    if (path !== FS.defaultPath) {
      deleteFile(path)
    }
    // If this is a screen menu, then we're deleting the folder we're in,
    // and we need to navigate up twice.
    if (mode === 'screen') {
      navigateUp()
      navigateUp()
    } else {
      navigateUp()
    }
  }, [deleteFile, navigateUp, mode, path])
  const props = {
    onBack,
    onDelete,
    path,
    title: 'Confirmation',
  }
  return <ReallyDeleteFile {...props} />
}

export default Container
