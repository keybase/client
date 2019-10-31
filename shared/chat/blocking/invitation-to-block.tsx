import * as React from 'react'
import * as Kb from '../../common-adapters'
import {WaveButton} from '../../settings/contacts-joined/buttons'
import * as Styles from '../../styles'
type Props = {team?: string; usernames?: Array<string>}

const BlockButtons = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true}>
      <Kb.Text type="BodySmall">
        {props.team ? 'Someone added you to this team.' : "You don't seem to know the sender."}
      </Kb.Text>
      {props.usernames && <WaveButton usernames={props.usernames.join(',')} style={styles.button} />}
      {props.usernames && props.usernames.length === 1 && (
        <Kb.Button label="View Profile" style={styles.button} mode="Secondary" />
      )}
      {props.team && <Kb.Button label="View team" style={styles.button} mode="Secondary" />}
      <Kb.Button label="Block" type="Danger" style={styles.button} />
    </Kb.Box2>
  )
}

export default BlockButtons

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        ...Styles.padding(0, Styles.globalMargins.small),
        width: '100%',
      },
    } as const)
)
