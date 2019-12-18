import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {FeaturedBot} from 'constants/types/rpc-gen'

type Props = FeaturedBot & {
  description?: string
  onShowProfile: (username: string) => void
}

const Bot = ({botAlias, description, botUsername, ownerTeam, ownerUser, onShowProfile}: Props) => {
  const lower = (
    <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny" alignSelf="flex-start">
      {description !== '' && (
        <Kb.Text type="BodySmall" lineClamp={1} onClick={() => onShowProfile(botUsername)}>
          {description}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

  const usernameDisplay = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start">
      <Kb.Text
        type="BodySmallSemibold"
        style={{color: Styles.globalColors.black}}
        onClick={() => onShowProfile(botUsername)}
      >
        {botAlias || botUsername}
      </Kb.Text>
      <Kb.Text type="BodySmall">
        &nbsp;• by{' '}
        {ownerTeam ? (
          <Kb.Text type="BodySmall">@{ownerTeam}</Kb.Text>
        ) : (
          <Kb.ConnectedUsernames
            prefix="@"
            inline={true}
            usernames={[ownerUser ?? botUsername]}
            type="BodySmall"
            withProfileCardPopup={true}
          />
        )}
      </Kb.Text>
    </Kb.Box2>
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
          <Kb.Avatar
            size={Styles.isMobile ? 48 : 32}
            style={styles.avatarStyle}
            username={botUsername}
            onClick={() => onShowProfile(botUsername)}
          />
          <Kb.Box2 direction="vertical">
            {usernameDisplay}
            {lower}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatarStyle: Styles.platformStyles({
        isElectron: {marginRight: Styles.globalMargins.tiny},
        isMobile: {marginRight: Styles.globalMargins.small},
      }),
      container: {
        paddingTop: Styles.globalMargins.tiny,
      },
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
        isMobile: {
          minHeight: 56,
        },
      }),
    } as const)
)

export default Bot
