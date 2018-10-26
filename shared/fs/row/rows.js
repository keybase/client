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
  inDestinationPicker?: boolean,
}

export const WrapRow = ({children, noDivider}: {children: React.Node, noDivider?: boolean}) => (
  <Kb.Box style={styles.rowContainer}>
    {children}
    {!noDivider && <Kb.Divider key="divider" style={styles.divider} />}
  </Kb.Box>
)

export const EmptyRow = () => <Kb.Box style={styles.rowContainer} />

class Rows extends React.PureComponent<Props> {
  _rowRenderer = (index: number, item: Types.RowItem) => {
    const noDivider = this.props.inDestinationPicker && index === this.props.items.length - 1
    switch (item.rowType) {
      case 'placeholder':
        return (
          <WrapRow key={`placeholder:${item.name}`} noDivider={noDivider}>
            <Placeholder type={item.type} />
          </WrapRow>
        )
      case 'tlf-type':
        return (
          <WrapRow key={`still:${item.name}`} noDivider={noDivider}>
            <TlfType
              name={item.name}
              inDestinationPicker={this.props.inDestinationPicker}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'tlf':
        return (
          <WrapRow key={`still:${item.name}`} noDivider={noDivider}>
            <Tlf
              name={item.name}
              tlfType={item.tlfType}
              inDestinationPicker={this.props.inDestinationPicker}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'still':
        return (
          <WrapRow key={`still:${item.name}`} noDivider={noDivider}>
            <Still
              name={item.name}
              path={item.path}
              inDestinationPicker={this.props.inDestinationPicker}
              routePath={this.props.routePath}
            />
          </WrapRow>
        )
      case 'uploading':
        return (
          <WrapRow key={`uploading:${item.name}`} noDivider={noDivider}>
            <Uploading name={item.name} path={item.path} />
          </WrapRow>
        )
      case 'editing':
        return (
          <WrapRow key={`editing:${Types.editIDToString(item.editID)}`} noDivider={noDivider}>
            <Editing editID={item.editID} routePath={this.props.routePath} />
          </WrapRow>
        )
      case 'empty':
        return <EmptyRow key={`empty:${item.name}`} />
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
      <Kb.List
        fixedHeight={rowHeight}
        items={
          // If we are in the destination picker, inject two empty rows so when
          // user scrolls to the bottom nothing is blocked by the
          // semi-transparent footer.
          !isMobile && this.props.inDestinationPicker
            ? [...this.props.items, {rowType: 'empty', name: '/empty0'}, {rowType: 'empty', name: '/empty1'}]
            : this.props.items
        }
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
