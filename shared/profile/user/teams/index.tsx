import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/tracker2'
import * as Styles from '../../../styles'
import OpenMeta from './openmeta'
import TeamInfo from './teaminfo'

type Props = {
  // lint totally confused
  // eslint-disable-next-line no-use-before-define
  teamShowcase: ReadonlyArray<Types._TeamShowcase>
  teamMeta: {
    [K in string]: {
      inTeam: boolean
    }
  }
  onJoinTeam: (arg0: string) => void
  onViewTeam: (arg0: string) => void
  onEdit: (() => void) | null
}

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
        <Kb.Icon type="icon-team-placeholder-avatar-32" style={styles.placeholderTeam} />
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
        <TeamShowcase
          key={t.name}
          {...t}
          onJoinTeam={p.onJoinTeam}
          onViewTeam={p.onViewTeam}
          inTeam={p.teamMeta[t.name].inTeam}
        />
      ))}
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate({
  link: {color: Styles.globalColors.black},
  placeholderTeam: {borderRadius: Styles.borderRadius},
  showcase: {alignItems: 'center'},
  showcases: {
    alignItems: 'flex-start',
    flexShrink: 0,
    paddingBottom: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.tiny,
  },
  youPublishTeam: {
    alignSelf: 'center',
    color: Styles.globalColors.black_50,
  },
})

export default Teams
