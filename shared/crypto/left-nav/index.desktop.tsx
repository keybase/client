import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/crypto'
import * as Types from '../../constants/types/crypto'
import NavRow from './nav-row'
import {Props} from './index'
import {TabActions} from '@react-navigation/core'

type Row = Types.Tab & {
  isSelected: boolean
  key: string
}

class SubNav extends React.PureComponent<Props> {
  private getRows = () =>
    Constants.Tabs.map((t, i) => ({
      ...t,
      isSelected: this.props.state.index === i,
      key: t.tab,
    }))

  private _onClick = (tab: Types.CryptoSubTab) => {
    const route = this.props.routes.find(r => r.name === tab)
    const event = this.props.navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    })

    if (!event.defaultPrevented) {
      this.props.navigation.dispatch({
        ...TabActions.jumpTo(tab),
        target: this.props.state.key,
      })
    }
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
