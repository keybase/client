import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/fs'

export type Props = {
  onBack: () => void
  onDelete: () => void
  path: Types.Path
  title: string
}

const _ReallyDeleteFile = (props: Props) =>
  props.path ? (
    <Kb.ConfirmModal
      confirmText="Yes, delete"
      description="It will be deleted for everyone. This cannot be undone."
      header={<Kb.Icon type="iconfont-trash" sizeType="Big" color={Styles.globalColors.red} />}
      onCancel={props.onBack}
      onConfirm={props.onDelete}
      prompt={`Are you sure you want to delete "${Types.getPathName(props.path)}"?`}
    />
  ) : null

export default Kb.HeaderOnMobile(_ReallyDeleteFile)
