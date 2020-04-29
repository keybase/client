import * as React from 'react'
import * as Flow from '../../../util/flow'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/fs'
import * as RowTypes from './types'
import Placeholder from './placeholder'
import TlfType from './tlf-type-container'
import Tlf from './tlf-container'
import Still from './still-container'
import Editing from './editing'
import {normalRowHeight} from './common'
import {memoize} from '../../../util/memoize'
import {useFsChildren, UploadButton} from '../../common'

export type Props = {
  emptyMode: 'empty' | 'not-empty-but-no-match' | 'not-empty'
  destinationPickerIndex?: number
  items: Array<RowTypes.RowItem>
  path: Types.Path
}

export const WrapRow = ({children}: {children: React.ReactNode}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    <Kb.Divider key="divider" style={styles.divider} />
  </Kb.Box>
)

export const EmptyRow = () => <Kb.Box style={styles.rowContainer} />

class Rows extends React.PureComponent<Props> {
  _rowRenderer = (_: number, item: RowTypes.RowItem) => {
    switch (item.rowType) {
      case RowTypes.RowType.Placeholder:
        return (
          <WrapRow>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case RowTypes.RowType.TlfType:
        return (
          <WrapRow>
            <TlfType name={item.name} destinationPickerIndex={this.props.destinationPickerIndex} />
          </WrapRow>
        )
      case RowTypes.RowType.Tlf:
        return (
          <WrapRow>
            <Tlf
              disabled={item.disabled}
              name={item.name}
              tlfType={item.tlfType}
              destinationPickerIndex={this.props.destinationPickerIndex}
            />
          </WrapRow>
        )
      case RowTypes.RowType.Still:
        return (
          <WrapRow>
            {item.editID ? (
              <Editing editID={item.editID} />
            ) : (
              <Still path={item.path} destinationPickerIndex={this.props.destinationPickerIndex} />
            )}
          </WrapRow>
        )
      case RowTypes.RowType.NewFolder:
        return (
          <WrapRow>
            <Editing editID={item.editID} />
          </WrapRow>
        )
      case RowTypes.RowType.Empty:
        return <EmptyRow />
      case RowTypes.RowType.Header:
        return item.node
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(item)
        return (
          <WrapRow>
            <Kb.Text type="BodySmallError">This should not happen.</Kb.Text>
          </WrapRow>
        )
    }
  }
  _getVariableRowLayout = (items, index) => ({
    index,
    length: getRowHeight(items[index] || _unknownEmptyRowItem),
    offset: items.slice(0, index).reduce((offset, row) => offset + getRowHeight(row), 0),
  })
  _getTopVariableRowCountAndTotalHeight = memoize(items => {
    const index = items.findIndex(row => row.rowType !== RowTypes.RowType.Header)
    return index === -1
      ? {count: items.length, totalHeight: -1}
      : {count: index, totalHeight: this._getVariableRowLayout(items, index).offset}
  })
  _getItemLayout = index => {
    const top = this._getTopVariableRowCountAndTotalHeight(this.props.items)
    if (index < top.count) {
      return this._getVariableRowLayout(this.props.items, index)
    }
    return {
      index,
      length: getRowHeight(this.props.items[index] || _unknownEmptyRowItem),
      offset: (index - top.count) * normalRowHeight + top.totalHeight,
    }
  }
  // List2 caches offsets. So have the key derive from layouts so that we
  // trigger a re-render when layout changes. Also encode items length into
  // this, otherwise we'd get taller-than content rows when going into a
  // smaller folder from a larger one.
  _getListKey = memoize(items => {
    const index = items.findIndex(row => row.rowType !== RowTypes.RowType.Header)
    return (
      items
        .slice(0, index === -1 ? items.length : index)
        .map(row => getRowHeight(row).toString())
        .join('-') + `:${items.length}`
    )
  })

  render() {
    return this.props.emptyMode !== 'not-empty' ? (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        {// The folder is empty so these should all be header rows.
        this.props.items.map(item => item.rowType === RowTypes.RowType.Header && item.node)}
        <Kb.Box2 direction="vertical" style={styles.emptyContainer} centerChildren={true} gap="small">
          <Kb.Text type="BodySmall">
            {this.props.emptyMode === 'empty'
              ? 'This folder is empty.'
              : 'Sorry, no folder or file was found.'}
          </Kb.Text>
          {this.props.emptyMode === 'empty' && <UploadButton path={this.props.path} />}
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.BoxGrow>
        <Kb.List2
          key={this._getListKey(this.props.items)}
          items={this.props.items}
          bounces={true}
          itemHeight={{
            getItemLayout: this._getItemLayout,
            type: 'variable',
          }}
          renderItem={this._rowRenderer}
        />
      </Kb.BoxGrow>
    )
  }
}

const RowsWithAutoLoad = (props: Props) => {
  useFsChildren(props.path, /* recursive */ true) // need recursive for the EMPTY tag
  return <Rows {...props} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      divider: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.black_05,
        },
        isElectron: {
          marginLeft: 94,
        },
        isMobile: {
          marginLeft: 102,
        },
      }),
      emptyContainer: {
        ...Styles.globalStyles.flexGrow,
      },
      rowContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        flexShrink: 0,
        height: normalRowHeight,
      },
    } as const)
)

const getRowHeight = (row: RowTypes.RowItem) =>
  row.rowType === RowTypes.RowType.Header ? row.height : normalRowHeight

const _unknownEmptyRowItem: RowTypes.EmptyRowItem = {
  key: 'unknown-empty-row-item',
  rowType: RowTypes.RowType.Empty,
}

export default RowsWithAutoLoad
