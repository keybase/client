import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/crypto'
import type * as Types from '../../constants/types/crypto'
import NavRow from './nav-row'

type Row = Types.Tab & {
  isSelected: boolean
  key: string
}

type Props = {
  onClick: (string) => void
  selected: string
  children?: React.ReactNode
}

class SubNav extends React.PureComponent<Props> {
  private getRows = () =>
    Constants.Tabs.map(t => ({
      ...t,
      isSelected: this.props.selected === t.tab,
      key: t.tab,
    }))

  private _onClick = (tab: Types.CryptoSubTab) => {
    this.props.onClick(tab)
  }

  private renderItem = (_: number, row: Row) => {
    return (
      <NavRow
        key={row.tab}
        isSelected={row.isSelected}
        title={row.title}
        tab={row.tab}
        icon={row.icon}
        onClick={() => this._onClick(row.tab)}
      />
    )
  }

  render() {
    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.listContainer}>
          <Kb.BoxGrow>
            <Kb.List
              items={this.getRows()}
              renderItem={this.renderItem}
              keyProperty="key"
              style={styles.list}
            />
          </Kb.BoxGrow>
        </Kb.Box2>
        {this.props.children}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  list: {
    ...Styles.globalStyles.fullHeight,
  },
  listContainer: {
    backgroundColor: Styles.globalColors.blueGrey,
    borderStyle: 'solid',
    flexGrow: 0,
    flexShrink: 0,
    width: 180,
  },
}))

export default SubNav
