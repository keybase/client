// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/tracker2'
import * as Constants from '../../../constants/tracker2'
import * as Styles from '../../../styles'

type Props = {|
  teamShowcase: $ReadOnlyArray<Types._TeamShowcase>,
  teamMeta: {
    [name: string]: {
      inTeam: boolean,
    },
  },
  onJoinTeam: string => void,
  onEdit: ?() => void,
|}

const OpenMeta = ({isOpen}) =>
  isOpen && <Kb.Meta backgroundColor={Styles.globalColors.green} title="open" style={styles.meta} />

const TeamInfo = p => (
  <Kb.FloatingMenu
    attachTo={p.attachTo}
    closeOnSelect={false}
    onHidden={p.onHidden}
    visible={p.visible}
    header={{
      title: 'header',
      view: (
        <Kb.Box2
          centerChildren={true}
          direction="vertical"
          gap="tiny"
          gapStart={true}
          gapEnd={true}
          style={styles.infoPopup}
        >
          <Kb.NameWithIcon
            avatarSize={48}
            teamname={p.name}
            title={p.name}
            metaOne={
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Text type="BodySmall">TEAM</Kb.Text>
                <OpenMeta isOpen={p.isOpen} />
              </Kb.Box2>
            }
            metaTwo={
              <Kb.Text type="BodySmall">
                {p.membersCount} member{p.membersCount > 1 ? 's' : ''}
              </Kb.Text>
            }
          />
          <Kb.Text type="Body" style={styles.description}>
            {p.description}
          </Kb.Text>
          {!p.inTeam && (
            <Kb.WaitingButton
              type="Primary"
              waitingKey={Constants.waitingKey}
              label="Request to join"
              onClick={() => p.onJoinTeam(p.name)}
            />
          )}
          <Kb.Text type="BodySmall">
            Public admins:{' '}
            {
              <Kb.ConnectedUsernames
                type="BodySmall"
                colorFollowing={true}
                colorBroken={true}
                onUsernameClicked="profile"
                usernames={p.publicAdmins}
                containerStyle={styles.publicAdmins}
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
      <>
        <TeamInfo
          {...p}
          attachTo={p.getAttachmentRef}
          onHidden={p.toggleShowingMenu}
          visible={p.showingMenu}
        />
        <Kb.Avatar size={32} teamname={p.name} isTeam={true} />
      </>
      <Kb.Text type="BodySemiboldLink" style={styles.link}>
        {p.name}
      </Kb.Text>
      <OpenMeta isOpen={p.isOpen} />
    </Kb.Box2>
  </Kb.ClickableBox>
)
const TeamShowcase = Kb.OverlayParentHOC(_TeamShowcase)

const ShowcaseTeamsOffer = p => (
  <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
    <Kb.ClickableBox onClick={p.onEdit}>
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Icon type="icon-team-placeholder-avatar-32" size={32} style={styles.placeholderTeam} />
        <Kb.Text style={styles.youPublishTeam} type="BodyPrimaryLink">
          Publish the teams you're in
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  </Kb.Box2>
)

const Teams = (p: Props) =>
  p.onEdit || p.teamShowcase.length > 0 ? (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.showcases}>
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
        {!!p.onEdit && <Kb.Icon type="iconfont-edit" onClick={p.onEdit} />}
      </Kb.Box2>
      {!!p.onEdit && !p.teamShowcase.length && <ShowcaseTeamsOffer onEdit={p.onEdit} />}
      {p.teamShowcase.map(t => (
        <TeamShowcase key={t.name} {...t} onJoinTeam={p.onJoinTeam} inTeam={p.teamMeta[t.name].inTeam} />
      ))}
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  description: {textAlign: 'center'},
  infoPopup: {
    maxWidth: 225,
    padding: Styles.globalMargins.small,
  },
  link: {color: Styles.globalColors.black_75},
  meta: {alignSelf: 'center'},
  placeholderTeam: {borderRadius: Styles.borderRadius},
  publicAdmins: Styles.platformStyles({
    isElectron: {display: 'unset'},
  }),
  showcase: {alignItems: 'center'},
  showcases: Styles.platformStyles({
    common: {
      alignItems: 'flex-start',
      flexShrink: 0,
      paddingBottom: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  youPublishTeam: {
    alignSelf: 'center',
    color: Styles.globalColors.black_20,
  },
})

export default Teams
