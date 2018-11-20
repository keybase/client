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
import {rowHeight} from './common'
import {isMobile} from '../../constants/platform'

type Props = {
  items: Array<Types.RowItem>,
  routePath: I.List<string>,
  destinationPickerIndex?: number,
}

// can't just do `Types.RowItem & {key: string}` because flow doesn't like it.
// TODO: maybe someday flow can figure it out?
type RowItemWithKey =
  | ({key: string} & Types.TlfTypeRowItem)
  | ({key: string} & Types.TlfRowItem)
  | ({key: string} & Types.StillRowItem)
  | ({key: string} & Types.EditingRowItem)
  | ({key: string} & Types.UploadingRowItem)
  | ({key: string} & Types.PlaceholderRowItem)
  | ({key: string} & Types.EmptyRowItem)

export const WrapRow = ({children}: {children: React.Node}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    <Kb.Divider key="divider" style={styles.divider} />
  </Kb.Box>
)

export const EmptyRow = () => <Kb.Box style={styles.rowContainer} />

// We need to make sure not only rendered items, but also prop items have `key`
// on each item. The latter is used by RN's List and former is used by react.js
// list.
const insertKeys = (items: Array<Types.RowItem>): Array<RowItemWithKey> =>
  // $FlowIssue
  items.map(item => ({...item, key: `${item.rowType}:${item.name}`}))

class Rows extends React.PureComponent<Props> {
  _rowRenderer = (index: number, item: RowItemWithKey) => {
    switch (item.rowType) {
      case 'placeholder':
        return (
          <WrapRow key={item.key}>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case 'tlf-type':
        return (
          <WrapRow key={item.key}>
            <TlfType
              name={item.name}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'tlf':
        return (
          <WrapRow key={item.key}>
            <Tlf
              name={item.name}
              tlfType={item.tlfType}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'still':
        return (
          <WrapRow key={item.key}>
            <Still
              name={item.name}
              path={item.path}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'uploading':
        return (
          <WrapRow key={item.key}>
            <Uploading name={item.name} path={item.path} />
          </WrapRow>
        )
      case 'editing':
        return (
          <WrapRow key={item.key}>
            <Editing editID={item.editID} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'empty':
        return <EmptyRow key={item.key} />
      default:
        /*::
      let rowType = item.rowType
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (rowType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(rowType);
      */
        return (
          <WrapRow key={item.key}>
            <Kb.Text type="BodySmallError">This should not happen.</Kb.Text>
          </WrapRow>
        )
    }
  }
  render() {
    return this.props.items && this.props.items.length ? (
      <Kb.List
        fixedHeight={rowHeight}
        items={insertKeys(
          // If we are in the destination picker, inject two empty rows so when
          // user scrolls to the bottom nothing is blocked by the
          // semi-transparent footer.
          !isMobile && this.props.destinationPickerIndex
            ? [...this.props.items, {rowType: 'empty', name: '/empty0'}, {rowType: 'empty', name: '/empty1'}]
            : this.props.items
        )}
        renderItem={this._rowRenderer}
      />
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
        <Kb.Text type="BodySmall">This is an empty folder.</Kb.Text>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    height: rowHeight,
    flexShrink: 0,
  },
  divider: {
    marginLeft: 48,
    backgroundColor: Styles.globalColors.black_05,
  },
})

export default Rows
