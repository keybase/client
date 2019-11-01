import * as React from 'react'
import * as Kb from '../../common-adapters'
import {WaveButton} from '../../settings/contacts-joined/buttons'
import * as Styles from '../../styles'
type Props = {adder: string; others?: Array<string>; team?: string}

const BlockButtons = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" gap="tiny" centerChildren={true}>
      <Kb.Text type="BodySmall">
        {props.team ? `${props.adder} added you to this team.` : `You don't seem to know ${props.adder}.`}
      </Kb.Text>
      {!props.team && (
        <WaveButton usernames={[props.adder, ...(props.others || [])].join(',')} style={styles.button} />
      )}
      {!props.team && !props.others && (
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
