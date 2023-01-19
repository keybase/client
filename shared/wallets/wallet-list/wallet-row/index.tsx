import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

// TODO: This is now desktop-only, so remove references to isMobile.

export type Props = {
  contents: string
  isSelected: boolean
  keybaseUser: string
  name: string
  onSelect: () => void
  unreadPayments: number
}

const rightColumnStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const styles = Styles.styleSheetCreate(
  () =>
    ({
      amount: Styles.platformStyles({
        isElectron: {...rightColumnStyle},
      }),
      amountSelected: Styles.platformStyles({
        common: {color: Styles.globalColors.white},
        isElectron: {...rightColumnStyle},
      }),
      avatar: {marginRight: Styles.globalMargins.xtiny},
      badge: {
        marginLeft: 6,
      },
      containerBox: {
        height: Styles.isMobile ? 56 : 48,
      },
      icon: {
        alignSelf: 'center',
        height: 32,
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
      rightColumn: Styles.platformStyles({
        isElectron: {...rightColumnStyle},
      }),
      title: Styles.platformStyles({
        common: {color: Styles.globalColors.black},
        isElectron: {...rightColumnStyle},
      }),
      titleSelected: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.fontSemibold,
          color: Styles.globalColors.white,
        },
        isElectron: {...rightColumnStyle},
      }),
      unread: {
        backgroundColor: Styles.globalColors.orange,
        borderRadius: 6,
        flexShrink: 0,
        height: Styles.globalMargins.tiny,
        width: Styles.globalMargins.tiny,
      },
      unreadContainer: {
        alignItems: 'center',
        alignSelf: 'stretch',
        flex: 1,
        justifyContent: 'flex-end',
        paddingRight: Styles.globalMargins.tiny,
      },
    } as const)
)

const WalletRow = (props: Props) => {
  return (
    <Kb.ClickableBox onClick={props.onSelect}>
      <Kb.Box2
        className="hover_background_color_blueGreyDark"
        style={Styles.collapseStyles([
          styles.containerBox,
          props.isSelected ? {backgroundColor: Styles.globalColors.purpleLight} : {},
        ])}
        direction="horizontal"
        fullWidth={true}
      >
        <Kb.Icon
          type={props.isSelected ? 'icon-wallet-open-32' : 'icon-wallet-32'}
          color={Styles.globalColors.black}
          style={styles.icon}
        />
        <Kb.Box2 direction="vertical" style={styles.rightColumn}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {!!props.keybaseUser && (
              <Kb.Avatar size={16} style={styles.avatar} username={props.keybaseUser} />
            )}
            <Kb.Text type="BodySemibold" style={props.isSelected ? styles.titleSelected : styles.title}>
              {props.name}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Text type="BodySmall" style={props.isSelected ? styles.amountSelected : styles.amount}>
            {props.contents}
          </Kb.Text>
        </Kb.Box2>
        {!!props.unreadPayments && <UnreadIcon unreadPayments={props.unreadPayments} />}
      </Kb.Box2>
      <Kb.Divider />
    </Kb.ClickableBox>
  )
}

const UnreadIcon = (props: {unreadPayments: number}) => (
  <Kb.Box2 direction="horizontal" style={styles.unreadContainer}>
    {Styles.isMobile ? (
      <Kb.Badge badgeNumber={props.unreadPayments} badgeStyle={styles.badge} />
    ) : (
      <Kb.Box2 direction="vertical" style={styles.unread} />
    )}
  </Kb.Box2>
)

export {WalletRow}
