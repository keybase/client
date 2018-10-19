// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import Placeholder from './placeholder'
import TlfType from './tlf-type-container'
import Tlf from './tlf-container'
import Still from './still-container'
import Editing from './editing-container'
import Uploading from './uploading-container'

type Props = {
  items: Array<Types.RowItem>,
  routePath: I.List<string>,
  ifEmpty?: ?React.Node,
}

export const WrapRow = ({children}: {children: React.Node}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    <Kb.Divider key="divider" style={styles.divider} />
  </Kb.Box>
)

class Rows extends React.PureComponent<Props> {
  _rowRenderer = (index: number, item: Types.RowItem) => {
    switch (item.rowType) {
      case 'placeholder':
        return (
          <WrapRow key={`placeholder:${item.name}`}>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case 'tlf-type':
        return (
          <WrapRow key={`still:${item.name}`}>
            <TlfType name={item.name} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'tlf':
        return (
          <WrapRow key={`still:${item.name}`}>
            <Tlf name={item.name} tlfType={item.tlfType} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'still':
        return (
          <WrapRow key={`still:${item.name}`}>
            <Still name={item.name} path={item.path} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'uploading':
        return (
          <WrapRow key={`uploading:${item.name}`}>
            <Uploading name={item.name} path={item.path} />
          </WrapRow>
        )
      case 'editing':
        return (
          <WrapRow key={`editing:${Types.editIDToString(item.editID)}`}>
            <Editing editID={item.editID} routePath={this.props.routePath} />
          </WrapRow>
        )
      default:
        /*::
      let rowType = item.rowType
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (rowType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(rowType);
      */
        return (
          <WrapRow key="">
            <Kb.Text type="BodySmallError">This should not happen.</Kb.Text>
          </WrapRow>
        )
    }
  }
  render() {
    return this.props.items && this.props.items.length ? (
      <Kb.List fixedHeight={rowHeight} items={this.props.items} renderItem={this._rowRenderer} />
    ) : (
      !!this.props.ifEmpty && this.props.ifEmpty
    )
  }
}

const rowHeight = Styles.isMobile ? 64 : 40

const styles = Styles.styleSheetCreate({
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    height: rowHeight,
    minHeight: rowHeight,
    maxHeight: rowHeight,
  },
  divider: {
    marginLeft: 48,
  },
})

export default Rows
