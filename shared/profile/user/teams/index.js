// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/tracker2'
import * as Constants from '../../../constants/tracker2'
import * as Styles from '../../../styles'

type Props = {|
  teamShowcase: ?$ReadOnlyArray<Types._TeamShowcase>,
  onJoinTeam: string => void,
|}

const TeamInfo = p => (
  <Kb.FloatingMenu
    attachTo={p.attachTo}
    closeOnSelect={false}
    onHidden={p.onHidden}
    visible={p.visible}
    header={{
      title: 'header',
      view: (
        <Kb.Box2 centerChildren={true} direction="vertical" gap="tiny" gapStart={true} gapEnd={true}>
          <Kb.NameWithIcon
            avatarSize={48}
            teamname={p.name}
            title={p.name}
            metaOne={<Kb.Text type="BodySmall">TEAM</Kb.Text>}
            metaTwo={<Kb.Text type="BodySmall">{p.membersCount} members</Kb.Text>}
          />
          <Kb.Text type="Body">{p.description}</Kb.Text>
          <Kb.WaitingButton
            type="Primary"
            waitingKey={Constants.waitingKey}
            label="Request to join"
            onClick={() => p.onJoinTeam(p.name)}
          />
          <Kb.Text type="BodySmall">
            Public admins:{' '}
            {
              <Kb.ConnectedUsernames
                type="BodySmall"
                colorFollowing={true}
                colorBroken={true}
                onUsernameClicked="profile"
                usernames={[p.publicAdmins]}
                inline={true}
              />
            }
          </Kb.Text>
        </Kb.Box2>
      ),
    }}
    position="bottom left"
    items={[]}
  />
)

const _TeamShowcase = p => (
  <Kb.ClickableBox ref={p.setAttachmentRef} onClick={p.toggleShowingMenu}>
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.showcase}>
      <TeamInfo
        attachTo={p.getAttachmentRef}
        onHidden={p.toggleShowingMenu}
        name={p.name}
        visible={p.showingMenu}
        publicAdmins={p.publicAdmins}
        description={p.description}
        membersCount={p.membersCount}
        onJoinTeam={p.onJoinTeam}
      />
      <Kb.Avatar size={32} teamname={p.name} isTeam={true} />
      <Kb.Text type="BodySemiboldLink" style={styles.link}>
        {p.name}
      </Kb.Text>
    </Kb.Box2>
  </Kb.ClickableBox>
)
const TeamShowcase = Kb.OverlayParentHOC(_TeamShowcase)

const Teams = (p: Props) =>
  p.teamShowcase && p.teamShowcase.length > 0 ? (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.showcases}>
      <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
      {p.teamShowcase.map(t => (
        <TeamShowcase key={t.name} {...t} />
      ))}
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  link: {color: Styles.globalColors.black_75},
  showcase: {alignItems: 'center'},
  showcases: {
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.small,
  },
})

export default Teams
