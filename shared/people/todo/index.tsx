import * as React from 'react'
import PeopleItem from '../item'
import * as Kb from '../../common-adapters'
import PeopleSearch from '../../profile/search/bar-container'
import * as Styles from '../../styles'

export type Props = {
  badged: boolean
  icon: Kb.IconType
  instructions: string
  confirmLabel: string
  dismissable: boolean
  onConfirm: () => void
  onDismiss: () => void
  showSearchBar?: boolean
}

export const Task = (props: Props) => (
  <PeopleItem format="multi" badged={props.badged} icon={<Kb.Icon type={props.icon} />}>
    <Kb.Text type="Body" style={styles.instructions}>
      {props.instructions}
    </Kb.Text>
    <Kb.Box style={styles.actionContainer}>
      {props.showSearchBar ? (
        <PeopleSearch style={styles.search} />
      ) : (
        <Kb.Button
          small={true}
          label={props.confirmLabel}
          onClick={props.onConfirm}
          style={{marginRight: Styles.globalMargins.small}}
        />
      )}
      {props.dismissable && (
        <Kb.Button small={true} label="Follow later" mode="Secondary" onClick={props.onDismiss} />
      )}
    </Kb.Box>
  </PeopleItem>
)

const styles = Styles.styleSheetCreate({
  actionContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginRight: Styles.isMobile ? 112 : 80,
    width: 'auto',
  },
  instructions: {marginRight: Styles.isMobile ? 112 : 80, marginTop: 2},
  search: {
    alignSelf: undefined,
    flexGrow: 0,
    marginBottom: Styles.globalMargins.xsmall,
    marginTop: Styles.globalMargins.xsmall,
  },
})
