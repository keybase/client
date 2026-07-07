import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'
import * as C from '@/constants'
import {newTeamWizardToAddMembersWizard, type NewTeamWizard} from './state'
import {AddRowButton, useStringList, WizardBanner, wizardInputStyle} from './common'
import {useNavigation} from '@react-navigation/native'

const cleanSubteamName = (name: string) => name.replace(/[^0-9a-zA-Z_]/, '')

type Props = {
  wizard: NewTeamWizard
}

const CreateSubteams = ({wizard: wizardState}: Props) => {
  const navigation = useNavigation('teamWizard6Subteams')
  const navigateAppend = C.Router2.navigateAppend
  const teamname = wizardState.name
  const initialSubteams = wizardState.subteams ?? ['', '', '']

  const {items: subteams, setItem: setSubteam, clearItem: onClear, addItem: onAdd} = useStringList(initialSubteams)

  const onContinue = () => {
    const wizard = {...wizardState, subteams: subteams.filter(Boolean)}
    navigation.setParams({wizard})
    navigateAppend({
      name: 'teamAddToTeamFromWhere',
      params: {wizard: newTeamWizardToAddMembersWizard(wizard)},
    })
  }

  const numSubteams = subteams.filter(c => !!c.trim()).length
  const continueLabel = numSubteams
    ? `Continue with ${numSubteams} ${pluralize('subteam', numSubteams)}`
    : 'Continue without subteams'

  return (
    <>
      <WizardBanner icon="icon-illustration-teams-subteams-460-96" />
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySmall">
          Subteams are cryptographically distinct, and can welcome people who aren’t elsewhere in your team
          hierarchy.
        </Kb.Text>
        {subteams.map((value, idx) => (
          <Kb.Input3
            value={value}
            onChangeText={(text: string) => setSubteam(idx, cleanSubteamName(text))}
            decoration={<Kb.Icon type="iconfont-remove" onClick={() => onClear(idx)} />}
            placeholder="subteam"
            prefix={`${teamname}.`}
            containerStyle={styles.input}
            maxLength={16}
            key={idx}
          />
        ))}
        <AddRowButton onAdd={onAdd} />
      </Kb.Box2>
      <Kb.ModalFooter>
        <Kb.Button fullWidth={true} label={continueLabel} onClick={onContinue} />
      </Kb.ModalFooter>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
    },
    isElectron: {minHeight: 326},
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  input: wizardInputStyle,
}))

export default CreateSubteams
