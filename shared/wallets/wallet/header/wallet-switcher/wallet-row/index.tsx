import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

export type Props = {
  contents: string
  isSelected: boolean
  keybaseUser: string
  name: string
  onSelect: () => void
  unreadPayments: number
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      amount: {
        color: Styles.globalColors.black_50,
        marginLeft: Styles.globalMargins.mediumLarge,
      },
      avatar: {marginRight: Styles.globalMargins.small},
      containerBox: {
        alignItems: 'flex-start',
        backgroundColor: Styles.globalColors.white,
        flexDirection: 'row',
        height: 48,
        width: '100%',
      },
      firstRowContainer: {
        alignSelf: 'flex-start',
      },
      icon: {
        height: 32,
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
        minWidth: 32,
      },
      rowContainer: {
        alignItems: 'flex-start',
      },
      title: {
        color: Styles.globalColors.blueDark,
      },
      titleSelected: {
        ...Styles.globalStyles.fontSemibold,
        color: Styles.globalColors.black,
      },
    } as const)
)

const WalletRow = (props: Props) => {
  const rightIcon = (
    <Kb.Box2 direction="horizontal" style={styles.icon}>
      {props.isSelected ? (
        <Kb.Icon type="iconfont-check" color={Styles.globalColors.blue} />
      ) : props.unreadPayments > 0 ? (
        <Kb.Badge badgeNumber={props.unreadPayments} />
      ) : null}
    </Kb.Box2>
  )
  return (
    <Kb.ClickableBox onClick={props.onSelect} style={styles.containerBox}>
      <Kb.Box2 direction="vertical" style={styles.rowContainer}>
        <Kb.Box2 direction="horizontal" style={styles.firstRowContainer}>
          {props.keybaseUser ? (
            <Kb.Avatar size={16} style={styles.avatar} username={props.keybaseUser} />
          ) : (
            <Kb.Icon style={styles.avatar} type="icon-placeholder-secret-user-16" />
          )}
          <Kb.Text type="BodyBig" style={props.isSelected ? styles.titleSelected : styles.title}>
            {props.name}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodySmall" style={styles.amount}>
          {props.contents}
        </Kb.Text>
      </Kb.Box2>
      {rightIcon}
    </Kb.ClickableBox>
  )
}

export {WalletRow}
