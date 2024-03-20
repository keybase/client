import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as RowTypes from './types'
import type * as T from '@/constants/types'
import Placeholder from './placeholder'
import TlfType from './tlf-type-container'
import Tlf from './tlf-container'
import Still from './still-container'
import Editing from './editing'
import {normalRowHeight} from './common'
import {useFsChildren, UploadButton} from '@/fs/common'

export type Props = {
  emptyMode: 'empty' | 'not-empty-but-no-match' | 'not-empty'
  destinationPickerIndex?: number
  items: Array<RowTypes.RowItem>
  path: T.FS.Path
}

export const WrapRow = ({children}: {children: React.ReactNode}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    <Kb.Divider key="divider" style={styles.divider} />
  </Kb.Box>
)

const EmptyRow = () => <Kb.Box style={styles.rowContainer} />

class Rows extends React.PureComponent<Props & {listKey: string}> {
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
        return (
          <WrapRow>
            <Kb.Text type="BodySmallError">This should not happen.</Kb.Text>
          </WrapRow>
        )
    }
  }
  _getVariableRowLayout = (items: Array<RowTypes.RowItem>, index: number) => ({
    index,
    length: getRowHeight(items[index] || _unknownEmptyRowItem),
    offset: items.slice(0, index).reduce((offset, row) => offset + getRowHeight(row), 0),
  })
  _getTopVariableRowCountAndTotalHeight = (items: Array<RowTypes.RowItem>) => {
    const index = items.findIndex(row => row.rowType !== RowTypes.RowType.Header)
    return index === -1
      ? {count: items.length, totalHeight: -1}
      : {count: index, totalHeight: this._getVariableRowLayout(items, index).offset}
  }
  _getItemLayout = (index: number) => {
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

  render() {
    return this.props.emptyMode !== 'not-empty' ? (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        {
          // The folder is empty so these should all be header rows.
          this.props.items.map(item => item.rowType === RowTypes.RowType.Header && item.node)
        }
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
          key={this.props.listKey}
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

  // List2 caches offsets. So have the key derive from layouts so that we
  // trigger a re-render when layout changes. Also encode items length into
  // this, otherwise we'd get taller-than content rows when going into a
  // smaller folder from a larger one.
  const {items} = props
  const listKey = React.useMemo(() => {
    const index = items.findIndex(row => row.rowType !== RowTypes.RowType.Header)
    return (
      items
        .slice(0, index === -1 ? items.length : index)
        .map(row => getRowHeight(row).toString())
        .join('-') + `:${items.length}`
    )
  }, [items])
  return <Rows {...props} listKey={listKey} />
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      divider: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.black_05_on_white,
        },
        isElectron: {
          marginLeft: 94,
        },
        isMobile: {
          marginLeft: 102,
        },
      }),
      emptyContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
      },
      rowContainer: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flexShrink: 0,
        height: normalRowHeight,
      },
    }) as const
)

const getRowHeight = (row: RowTypes.RowItem) =>
  row.rowType === RowTypes.RowType.Header ? row.height : normalRowHeight

const _unknownEmptyRowItem: RowTypes.EmptyRowItem = {
  key: 'unknown-empty-row-item',
  rowType: RowTypes.RowType.Empty,
}

export default RowsWithAutoLoad
