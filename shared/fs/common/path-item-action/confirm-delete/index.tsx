import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as T from '../../../../constants/types'

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
      header={<Kb.Icon type="iconfont-trash" sizeType="Big" color={Styles.globalColors.red} />}
      onCancel={props.onBack}
      onConfirm={props.onDelete}
      prompt={`Are you sure you want to delete "${T.FS.getPathName(props.path)}"?`}
    />
  ) : null

export default ReallyDeleteFile
