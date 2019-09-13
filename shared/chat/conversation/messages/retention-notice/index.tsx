import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

export type Props = {
  canChange: boolean
  onChange: () => void
  explanation: string
}

const iconType = Styles.isMobile ? 'icon-message-retention-48' : 'icon-message-retention-32'

export default (props: Props) => {
  return (
    <Kb.Box style={styles.container}>
      <Kb.Icon type={iconType} style={styles.icon} />
      <Kb.Text center={true} type="BodySmallSemibold">
        {props.explanation}
      </Kb.Text>
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
