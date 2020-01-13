import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {FeaturedBot} from 'constants/types/rpc-gen'

type Props = FeaturedBot & {
  conversationIDKey?: Types.ConversationIDKey
  description?: string
  onClick: (username: string) => void
  showAddToChannel?: boolean
}

type AddButtonProps = {
  conversationIDKey: Types.ConversationIDKey
  username: string
}

const AddBotToChannel = ({conversationIDKey, username}: AddButtonProps) => {
  const dispatch = Container.useDispatch()
  const addToChannel = () =>
    dispatch(Chat2Gen.createAddUsersToChannel({conversationIDKey, usernames: [username]}))
  return (
    <Kb.Button
      type="Dim"
      mode="Secondary"
      onClick={addToChannel}
      style={styles.addButton}
      icon="iconfont-new"
      tooltip="Add to this channel"
    />
  )
}

const Bot = ({
  botAlias,
  conversationIDKey,
  description,
  botUsername,
  showAddToChannel,
  onClick,
  ownerTeam,
  ownerUser,
}: Props) => {
  const lower = (
    <Kb.Box2
      direction="horizontal"
      alignItems="center"
      gap="xtiny"
      alignSelf="flex-start"
      fullWidth={true}
      style={{flex: 1}}
    >
      {description !== '' && (
        <Kb.Text type="BodySmall" lineClamp={1} onClick={() => onClick(botUsername)}>
          {description}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

  const usernameDisplay = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.black}}>
        {botAlias || botUsername}
      </Kb.Text>
      <Kb.Text type="BodySmall">&nbsp;• by&nbsp;</Kb.Text>
      {ownerTeam ? (
        <Kb.Text type="BodySmall">{`@${ownerTeam}`}</Kb.Text>
      ) : (
        <Kb.ConnectedUsernames
          prefix="@"
          inline={true}
          usernames={[ownerUser ?? botUsername]}
          type="BodySmall"
          withProfileCardPopup={true}
        />
      )}
    </Kb.Box2>
  )
  return (
    <Kb.ClickableBox onClick={() => onClick(botUsername)}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
            <Kb.Avatar size={Styles.isMobile ? 48 : 32} style={styles.avatarStyle} username={botUsername} />
            <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
              {usernameDisplay}
              {lower}
            </Kb.Box2>
            {showAddToChannel && conversationIDKey && (
              <AddBotToChannel username={botUsername} conversationIDKey={conversationIDKey} />
            )}
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Divider style={styles.divider} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addButton: {
        marginLeft: Styles.globalMargins.tiny,
      },
      avatarStyle: Styles.platformStyles({
        isElectron: {marginRight: Styles.globalMargins.tiny},
        isMobile: {marginRight: Styles.globalMargins.small},
      }),
      container: Styles.platformStyles({
        isElectron: {
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      divider: Styles.platformStyles({
        common: {
          marginTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: 56,
        },
        isMobile: {
          marginLeft: 81,
        },
      }),
      row: {
        alignItems: 'center',
        flex: 1,
        marginRight: Styles.globalMargins.tiny,
      },
      rowContainer: Styles.platformStyles({
        common: {
          minHeight: 48,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
        },
      }),
    } as const)
)

export default Bot
