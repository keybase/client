import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {ModalTitle} from '../common'

const AddMembersConfirm = () => {
  const {teamID, addingMembers} = Container.useSelector(s => s.teams.addMembersWizard)
  const teamname = Container.useSelector(s => Constants.getTeamMeta(s, teamID).teamname)

  return (
    <Kb.Modal
      allowOverflow={true}
      mode="DefaultFullHeight"
      header={{
        title: (
          <ModalTitle
            teamname={teamname}
            title={`Inviting ${addingMembers.length} ${addingMembers.length === 1 ? 'person' : 'people'}`}
          />
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="small">
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <AddingMembers />
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.controls}>
            <Kb.Text type="Body">Hi 1</Kb.Text>
            <Kb.Text type="Body">Hi 2</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const AddingMembers = () => {
  const addingMembers = Container.useSelector(s => s.teams.addMembersWizard.addingMembers)
  const content = (
    <Kb.Box2 direction="vertical" gap="xtiny">
      {addingMembers.map(toAdd => (
        <AddingMember key={toAdd.assertion} {...toAdd} />
      ))}
    </Kb.Box2>
  )
  if (Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" style={styles.addingMembers}>
        {content}
      </Kb.Box2>
    )
  }
  return <Kb.ScrollView style={styles.addingMembers}>{content}</Kb.ScrollView>
}

const AddingMember = (props: Types.AddingMember) => {
  const {role, teamID} = Container.useSelector(s => s.teams.addMembersWizard)
  const showDropdown = role === undefined
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center" style={styles.addingMember}>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
        <Kb.Avatar size={16} username={props.assertion} />
        <Kb.ConnectedUsernames type="BodySemibold" usernames={[props.assertion]} />
      </Kb.Box2>
      <Kb.Icon type="iconfont-remove" />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addingMember: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
    justifyContent: 'space-between',
    padding: Styles.globalMargins.tiny,
  },
  addingMembers: Styles.platformStyles({
    common: {
      ...Styles.padding(
        Styles.globalMargins.tiny,
        Styles.globalMargins.small,
        Styles.globalMargins.tiny,
        Styles.globalMargins.tiny
      ),
      backgroundColor: Styles.globalColors.blueGreyDark,
      borderRadius: Styles.borderRadius,
    },
    isElectron: {maxHeight: 168},
  }),
  body: {
    padding: Styles.globalMargins.small,
  },
  controls: {
    justifyContent: 'space-between',
  },
}))

export default AddMembersConfirm
