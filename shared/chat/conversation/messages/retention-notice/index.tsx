import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as Styles from '../../../../styles'
import {RetentionPolicy} from '../../../../constants/types/retention-policy'

export type Props = {
  canChange: boolean
  explanation?: string
  measure?: () => void
  onChange: () => void
  policy: RetentionPolicy
  teamPolicy: RetentionPolicy
}

const iconType = Styles.isMobile ? 'icon-message-retention-48' : 'icon-message-retention-32'

const RetentionNotice = (props: Props) => {
  Container.useDepChangeEffect(() => {
    props.measure && props.measure()
  }, [props.canChange, props.policy, props.teamPolicy])
  return (
    <Kb.Box style={styles.container}>
      <Kb.Icon type={iconType} style={styles.icon} />
      {!!props.explanation && (
        <Kb.Text center={true} type="BodySmallSemibold">
          {props.explanation}
        </Kb.Text>
      )}
      {props.canChange && (
        <Kb.Text
          type="BodySmallSemibold"
          style={{color: Styles.globalColors.blueDark}}
          onClick={props.onChange}
        >
          Change this
        </Kb.Text>
      )}
    </Kb.Box>
  )
}
export default RetentionNotice

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blueLighter3,
        paddingBottom: Styles.globalMargins.small,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
        paddingTop: Styles.globalMargins.small,
        width: '100%',
      },
      icon: {
        height: Styles.isMobile ? 48 : 32,
        marginBottom: Styles.globalMargins.tiny,
        width: Styles.isMobile ? 48 : 32,
      },
    } as const)
)
