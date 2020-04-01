import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/crypto'
import * as Types from '../../constants/types/crypto'
import {memoize} from '../../util/memoize'
import NavRow from './nav-row'
import {Props} from './index'

type Row = Types.Tab & {isSelected: boolean; key: string}

class SubNav extends React.PureComponent<Props> {
  private getRows = memoize((routeSelected: string) =>
    Constants.Tabs.map(t => ({
      ...t,
      isSelected: routeSelected === t.tab,
      key: t.tab,
    }))
  )

  private renderItem = (_: number, row: Row) => {
    return (
      <NavRow key={row.tab} isSelected={row.isSelected} title={row.title} tab={row.tab} icon={row.icon} />
    )
  }

  render() {
    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.listContainer}>
          <Kb.BoxGrow>
            <Kb.List
              items={this.getRows(this.props.routeSelected)}
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
