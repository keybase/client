// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Flow from '../../util/flow'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import Placeholder from './placeholder'
import TlfType from './tlf-type-container'
import Tlf from './tlf-container'
import Still from './still-container'
import Editing from './editing-container'
import Uploading from './uploading-container'
import SortBar from '../sortbar/container'
import {rowHeight} from './common'
import {isMobile} from '../../constants/platform'

type Props = {
  destinationPickerIndex?: number,
  items: Array<Types.RowItemWithKey>,
  path: Types.Path,
  routePath: I.List<string>,
}

export const WrapRow = ({children}: {children: React.Node}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    <Kb.Divider key="divider" style={styles.divider} />
  </Kb.Box>
)

export const EmptyRow = () => <Kb.Box style={styles.rowContainer} />

class Rows extends React.PureComponent<Props> {
  _rowRenderer = (index: number, item: Types.RowItem) => {
    switch (item.rowType) {
      case 'placeholder':
        return (
          <WrapRow>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case 'tlf-type':
        return (
          <WrapRow>
            <TlfType
              name={item.name}
              destinationPickerIndex={this.props.destinationPickerIndex}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'tlf':
        return (
          <WrapRow>
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
          <WrapRow>
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
          <WrapRow>
            <Uploading name={item.name} path={item.path} />
          </WrapRow>
        )
      case 'editing':
        return (
          <WrapRow>
            <Editing editID={item.editID} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'empty':
        return <EmptyRow />
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(item.rowType)
        return (
          <WrapRow>
            <Kb.Text type="BodySmallError">This should not happen.</Kb.Text>
          </WrapRow>
        )
    }
  }
  render() {
    return this.props.items && this.props.items.length ? (
      <>
        {// Only show sortbar if we are in the folder view.
        typeof this.props.destinationPickerIndex !== 'number' && <SortBar path={this.props.path} />}
        <Kb.List
          fixedHeight={rowHeight}
          items={
            // If we are in the destination picker, inject two empty rows so when
            // user scrolls to the bottom nothing is blocked by the
            // semi-transparent footer.
            !isMobile && typeof this.props.destinationPickerIndex === 'number'
              ? [...this.props.items, {key: 'empty:0', rowType: 'empty'}, {key: 'empty:1', rowType: 'empty'}]
              : this.props.items
          }
          renderItem={this._rowRenderer}
        />
      </>
    ) : (
      <Kb.Box2 direction="vertical" style={styles.emptyContainer} centerChildren={true}>
        <Kb.Text type="BodySmall">This folder is empty.</Kb.Text>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  divider: {
    backgroundColor: Styles.globalColors.black_05,
    marginLeft: 48,
  },
  emptyContainer: {
    ...Styles.globalStyles.flexGrow,
  },
  rowContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flexShrink: 0,
    height: rowHeight,
  },
})

export default Rows
