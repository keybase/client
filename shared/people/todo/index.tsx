import PeopleItem, {type TaskButton} from '../item'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  badged: boolean
  icon: Kb.IconType
  instructions: string
  subText?: string
  buttons: Array<TaskButton>
}

export const Task = (props: Props) => (
  <PeopleItem
    format="multi"
    badged={props.badged}
    icon={<Kb.Icon type={props.icon} />}
    buttons={props.buttons}
  >
    <Kb.Markdown style={styles.instructions}>{props.instructions}</Kb.Markdown>
    {!!props.subText && <Kb.Text type="BodySmall">{props.subText}</Kb.Text>}
  </PeopleItem>
)

const styles = Styles.styleSheetCreate(() => ({
  instructions: {marginTop: 2},
  search: {
    alignSelf: undefined,
    flexGrow: 0,
    marginBottom: Styles.globalMargins.xsmall,
    marginTop: Styles.globalMargins.xsmall,
  },
}))
