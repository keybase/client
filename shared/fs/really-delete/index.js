// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import {Box, ConfirmModal, HeaderOnMobile, Icon, MaybePopup, ProgressIndicator} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import * as Types from '../../constants/types/fs'

export type Props = {
  _deleting: boolean,
  onBack: () => void,
  onDelete: () => void,
  path: Types.Path,
  title: string,
}

const _Spinner = (props: Props) => (
  <MaybePopup onClose={props.onBack}>
    <Box
      style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.xlarge}}
    >
      <ProgressIndicator style={{width: globalMargins.medium}} />
    </Box>
  </MaybePopup>
)
const Spinner = HeaderOnMobile(_Spinner)

class _ReallyDeleteFile extends React.PureComponent<Props> {
  componentDidUpdate(prevProps: Props) {
    prevProps._deleting && !this.props._deleting && this.props.onBack()
  }
  render() {
    return (
      !!this.props.path && (
        <ConfirmModal
          confirmText="Yes, delete it."
          description="It will be gone forever."
          header={<Icon type="iconfont-trash" sizeType="Big" color={globalColors.red} />}
          onCancel={this.props.onBack}
          onConfirm={this.props.onDelete}
          prompt={`Are you sure you want to delete "${Types.pathToString(this.props.path)}"?`}
          waitingKey={Constants.deleteWaitingKey}
        />
      )
    )
  }
}

export default HeaderOnMobile(_ReallyDeleteFile)
export {Spinner}
