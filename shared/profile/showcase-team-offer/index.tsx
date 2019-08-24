import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {teamWaitingKey} from '../../constants/teams'
import * as Types from '../../constants/types/teams'

export type RowProps = {
  canShowcase: boolean
  name: Types.Teamname
  isOpen: boolean
  membercount: number
  onPromote: (promote: boolean) => void
  showcased: boolean
  waiting: boolean
  isExplicitMember: boolean
}

export type Props = {
  customCancelText: string
  customComponent?: React.ElementType | null
  headerStyle?: Object | null
  onCancel: () => void
  onPromote: (name: Types.Teamname, promote: boolean) => void
  teammembercounts: {[K in string]: number}
  teamnames: Array<Types.Teamname>
  teamNameToIsOpen: {[K in string]: boolean}
  teamNameToAllowPromote: {[K in string]: boolean}
  teamNameToIsShowcasing: {[K in string]: boolean}
  teamNameToRole: {[K in string]: 'reader' | 'writer' | 'admin' | 'owner' | 'none'}
  waiting: {[K in string]: number}
}

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
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
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
      {showcased || canShowcase || waiting ? (
        <Kb.Box2 direction="vertical">
          <Kb.Button
            label={showcased ? 'Published' : 'Publish'}
            onClick={() => onPromote(!showcased)}
            small={true}
            type="Success"
            mode={showcased ? 'Secondary' : 'Primary'}
            waiting={waiting}
          />
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" style={styles.membershipTextContainer}>
          <Kb.Text style={styles.membershipText} type="BodySmall">
            {isExplicitMember
              ? 'Admins aren’t allowing members to publish.'
              : 'Add yourself to the team first.'}
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
    {!Styles.isMobile && <Kb.Divider style={{marginLeft: 48}} />}
  </Kb.Box2>
)

const ShowcaseTeamOfferHeader = () => (
  <Kb.Box style={styles.headerContainer}>
    {!Styles.isMobile && (
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.headerText}>
        <Kb.Text type="Header">Publish the teams you’re in</Kb.Text>
      </Kb.Box2>
    )}
    <Kb.InfoNote containerStyle={styles.noteContainer}>
      <Kb.Text center={true} style={styles.noteText} type="BodySmall">
        Promoting a team will encourage others to ask to join. The team's description and number of members
        will be public.
      </Kb.Text>
    </Kb.InfoNote>
  </Kb.Box>
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
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.mediumLarge,
    },
  }),
  headerText: {
    marginBottom: Styles.globalMargins.xsmall,
  },
  membershipText: Styles.platformStyles({
    common: {color: Styles.globalColors.black_50},
    isElectron: {textAlign: 'right'},
    isMobile: {textAlign: 'center'},
  }),
  membershipTextContainer: {
    flexShrink: 1,
  },
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
  },
  teamNameContainer: {
    flexShrink: 1,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  teamRowContainer: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
    isMobile: {
      minHeight: Styles.isMobile ? 64 : 48,
    },
  }),
  teamText: {
    alignSelf: 'flex-start',
  },
})

export default ShowcaseTeamOffer
