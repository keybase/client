import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'

export type Props = {
  canChange: boolean
  explanation?: string
  onChange: () => void
  policy: RetentionPolicy
  teamPolicy: RetentionPolicy
}

const RetentionNotice = React.memo(function RetentionNotice(props: Props) {
  const iconType =
    props.policy.type === 'explode' ||
    (props.policy.type === 'inherit' && props.teamPolicy.type === 'explode')
      ? 'iconfont-bomb-solid'
      : 'iconfont-timer-solid'

  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.iconBox}>
        <Kb.Icon color={Styles.globalColors.black_20} fontSize={20} type={iconType} />
      </Kb.Box>
      {!!props.explanation && (
        <Kb.Text center={true} type="BodySmallSemibold">
          {props.explanation}
        </Kb.Text>
      )}
      {props.canChange && (
        <Kb.Text
          type="BodySmallSemiboldPrimaryLink"
          style={{color: Styles.globalColors.blueDark}}
          onClick={props.onChange}
        >
          Change this
        </Kb.Text>
      )}
    </Kb.Box>
  )
})
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
      iconBox: {
        marginBottom: Styles.globalMargins.xtiny,
      },
    } as const)
)
