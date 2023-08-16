import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import type * as T from '../../../constants/types'
import OpenMeta from './openmeta'
import TeamInfo from './teaminfo'

export type Props = {
  // lint totally confused
  teamShowcase: ReadonlyArray<T.Tracker.TeamShowcase>
  teamMeta: {
    [K in string]: {
      inTeam: boolean
      teamID: T.Teams.TeamID
    }
  }
  onJoinTeam: (teamname: string) => void
  onViewTeam: (teamname: string) => void
  onEdit?: () => void
}

// TODO types
const TeamShowcase = (props: any) => {
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return <TeamInfo {...props} attachTo={attachTo} onHidden={toggleShowingPopup} visible={true} />
    },
    [props]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <Kb.ClickableBox ref={popupAnchor} onClick={toggleShowingPopup}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.showcase}>
        <>
          {popup}
          <Kb.Avatar size={32} teamname={props.name} isTeam={true} />
        </>
        <Kb.Text type="BodySemiboldLink" style={styles.link}>
          {props.name}
        </Kb.Text>
        <OpenMeta isOpen={props.isOpen} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

// TODO types
const ShowcaseTeamsOffer = (p: any) => (
  <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
    <Kb.ClickableBox onClick={p.onEdit}>
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Icon type="icon-team-placeholder-avatar-32" style={styles.placeholderTeam} />
        <Kb.Text style={styles.youFeatureTeam} type="BodyPrimaryLink">
          Feature the teams you're in
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
          onViewTeam={() => p.onViewTeam(t.name)}
          inTeam={p.teamMeta[t.name]?.inTeam ?? false}
        />
      ))}
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate(
  () =>
    ({
      link: {color: Styles.globalColors.black},
      placeholderTeam: {borderRadius: Styles.borderRadius},
      showcase: {alignItems: 'center'},
      showcases: {
        alignItems: 'flex-start',
        flexShrink: 0,
        paddingBottom: Styles.globalMargins.small,
        paddingLeft: Styles.globalMargins.tiny,
      },
      youFeatureTeam: {
        alignSelf: 'center',
        color: Styles.globalColors.black_50,
      },
    }) as const
)

export default Teams
