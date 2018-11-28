// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {teamWaitingKey} from '../../constants/teams'

import type {RowProps, Props} from './index'

const TeamRow = ({
  canShowcase,
  name,
  isOpen,
  membercount,
  onPromote,
  showcased,
  waiting,
  isExplicitMember,
}: RowProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
      <Kb.Avatar isTeam={true} size={Styles.isMobile ? 48 : 32} teamname={name} />
      <Kb.Box2 direction="vertical" style={styles.teamNameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
          <Kb.Text type="BodySemibold" lineClamp={1}>
            {name}
          </Kb.Text>
          {isOpen && <Kb.Meta title="open" style={styles.meta} backgroundColor={Styles.globalColors.green} />}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.teamText}>
          <Kb.Text type="BodySmall">{membercount + ' member' + (membercount !== 1 ? 's' : '')}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        {showcased || canShowcase || waiting ? (
          <Kb.Button
            label={showcased ? 'Published' : 'Publish'}
            onClick={() => onPromote(!showcased)}
            small={true}
            style={{minWidth: 72}}
            type={showcased ? 'PrimaryGreenActive' : 'PrimaryGreen'}
            waiting={waiting}
          />
        ) : (
          <Kb.Text
            style={{color: Styles.globalColors.black_40, width: Styles.isMobile ? '35%' : '25%'}}
            type="BodySmall"
          >
            {isExplicitMember
              ? 'Admins aren’t allowing members to publish.'
              : 'You are not a member. Add yourself to publish.'}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
    {!Styles.isMobile && <Kb.Divider style={{marginLeft: 48}} />}
  </Kb.Box2>
)

const ShowcaseTeamOfferHeader = () => (
  <Kb.Box2 direction="vertical" style={styles.headerContainer}>
    {!Styles.isMobile && (
      <Kb.Box2 direction="horizontal">
        <Kb.Text type="Header">Publish the teams you’re in</Kb.Text>
      </Kb.Box2>
    )}
    <Kb.Box2 direction="horizontal" style={styles.noteContainer}>
      <Kb.InfoNote>
        <Kb.Text style={styles.noteText} type="BodySmall">
          Promoting a team will encourage others to ask to join. The team's description and number of members
          will be public.
        </Kb.Text>
      </Kb.InfoNote>
    </Kb.Box2>
  </Kb.Box2>
)

const ShowcaseTeamOffer = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    {!Styles.isMobile && <ShowcaseTeamOfferHeader />}
    <Kb.ScrollView>
      {Styles.isMobile && <ShowcaseTeamOfferHeader />}
      {props.teamnames &&
        props.teamnames.map(name => (
          <TeamRow
            canShowcase={
              (props.teamNameToRole[name] !== 'none' && props.teamNameToAllowPromote[name]) ||
              ['admin', 'owner'].indexOf(props.teamNameToRole[name]) !== -1
            }
            isExplicitMember={props.teamNameToRole[name] !== 'none'}
            key={name}
            name={name}
            isOpen={props.teamNameToIsOpen[name]}
            membercount={props.teammembercounts[name]}
            onPromote={promoted => props.onPromote(name, promoted)}
            showcased={props.teamNameToIsShowcasing[name]}
            waiting={!!props.waiting[teamWaitingKey(name)]}
          />
        ))}
    </Kb.ScrollView>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      maxHeight: 600,
      maxWidth: 600,
    },
  }),
  headerContainer: Styles.platformStyles({
    isElectron: {
      padding: Styles.globalMargins.small,
    },
  }),
  meta: {
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  noteContainer: Styles.platformStyles({
    isMobile: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  noteText: {
    paddingBottom: Styles.globalMargins.small,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.tiny,
    textAlign: 'center',
  },
  teamNameContainer: {
    marginLeft: Styles.globalMargins.small,
  },
  teamRowContainer: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      minHeight: Styles.isMobile ? 64 : 48,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  teamText: {
    alignSelf: 'flex-start',
  },
})

const PopupWrapped = (props: Props) => (
  <Kb.PopupDialog styleCover={{zIndex: 20}} onClose={props.onBack}>
    <ShowcaseTeamOffer {...props} />
  </Kb.PopupDialog>
)

export default (Styles.isMobile ? ShowcaseTeamOffer : PopupWrapped)
