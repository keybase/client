import * as React from 'react'
import PeopleItem from '../item'
import * as Kb from '../../common-adapters'
import PeopleSearch from '../../profile/search/bar-container'
import * as Styles from '../../styles'
import {Props as ButtonProps} from '../../common-adapters/button'

export type TaskButton = {
  label: string
  onClick: () => void
  type?: ButtonProps['type']
  mode?: ButtonProps['mode']
  waiting?: ButtonProps['waiting']
}

export type Props = {
  badged: boolean
  icon: Kb.IconType
  instructions: string
  subText?: string
  showSearchBar?: boolean
  buttons: Array<TaskButton>
}

export const Task = (props: Props) => (
  <PeopleItem format="multi" badged={props.badged} icon={<Kb.Icon type={props.icon} />}>
    <Kb.Markdown style={styles.instructions}>{props.instructions}</Kb.Markdown>
    {!!props.subText && <Kb.Text type="BodySmall">{props.subText}</Kb.Text>}
    <Kb.Box style={styles.actionContainer}>
      {props.showSearchBar && <PeopleSearch style={styles.search} />}
      {props.buttons.length > 0 &&
        props.buttons.map(b => <Kb.Button key={b.label} small={true} style={styles.button} {...b} />)}
    </Kb.Box>
  </PeopleItem>
)

const styles = Styles.styleSheetCreate({
  actionContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: 'auto',
  },
  button: {marginBottom: Styles.globalMargins.xtiny, marginRight: Styles.globalMargins.tiny},
  instructions: {marginTop: 2},
  search: {
    alignSelf: undefined,
    flexGrow: 0,
    marginBottom: Styles.globalMargins.xsmall,
    marginTop: Styles.globalMargins.xsmall,
  },
})
