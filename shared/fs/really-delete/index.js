// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'

export type Props = {
  _deleting: boolean,
  _onFinishDelete: () => void,
  onBack: () => void,
  onDelete: () => void,
  path: Types.Path,
  title: string,
}

class _ReallyDeleteFile extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    prevProps._deleting && !this.props._deleting && this.props._onFinishDelete()
  }
  render() {
    return (
      !!this.props.path && (
        <Kb.ConfirmModal
          confirmText="Yes, delete"
          description="It will be deleted for everyone. This cannot be undone."
          header={<Kb.Icon type="iconfont-trash" sizeType="Big" color={Styles.globalColors.red} />}
          onCancel={this.props.onBack}
          onConfirm={this.props.onDelete}
          prompt={`Are you sure you want to delete "${Types.getPathName(this.props.path)}"?`}
          waitingKey={Constants.deleteWaitingKey}
        />
      )
    )
  }
}

export default Kb.HeaderOnMobile(_ReallyDeleteFile)
