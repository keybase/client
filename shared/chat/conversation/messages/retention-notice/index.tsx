import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

export type Props = {
  canChange: boolean
  explanation?: string
  onChange: () => void
  policy: T.Retention.RetentionPolicy
  teamPolicy: T.Retention.RetentionPolicy
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
        <Kb.Icon color={Kb.Styles.globalColors.black_20} fontSize={20} type={iconType} />
      </Kb.Box>
      {!!props.explanation && (
        <Kb.Text center={true} type="BodySmallSemibold">
          {props.explanation}
        </Kb.Text>
      )}
      {props.canChange && (
        <Kb.Text
          type="BodySmallSemiboldPrimaryLink"
          style={{color: Kb.Styles.globalColors.blueDark}}
          onClick={props.onChange}
        >
          Change this
        </Kb.Text>
      )}
    </Kb.Box>
  )
})
export default RetentionNotice

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        paddingBottom: Kb.Styles.globalMargins.small,
        paddingLeft: Kb.Styles.globalMargins.medium,
        paddingRight: Kb.Styles.globalMargins.medium,
        paddingTop: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      iconBox: {
        marginBottom: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)
