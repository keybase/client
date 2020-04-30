import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import {pluralize} from '../../../util/string'
import {ModalTitle} from '../../common'

const cleanSubteamName = (name: string) => name.replace(/[^0-9a-zA-Z_]/, '')

const CreateSubteams = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = Types.newTeamWizardTeamID
  const teamname = Container.useSelector(s => s.teams.newTeamWizard.name)
  const initialSubteams = Container.useSelector(s => s.teams.newTeamWizard.subteams) ?? ['', '', '']

  const [subteams, setSubteams] = React.useState<Array<string>>([...initialSubteams])
  const setSubteam = (i: number, value: string) => {
    subteams[i] = value
    setSubteams([...subteams])
  }
  const onClear = (i: number) => {
    subteams.splice(i, 1)
    setSubteams([...subteams])
  }
  const onAdd = () => {
    subteams.push('')
    setSubteams([...subteams])
  }

  const onContinue = () =>
    dispatch(TeamsGen.createSetTeamWizardSubteams({subteams: subteams.filter(s => !!s)}))
  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  const numSubteams = subteams.filter(c => !!c.trim()).length
  const continueLabel = numSubteams
    ? `Continue with ${numSubteams} ${pluralize('subteam', numSubteams)}`
    : 'Continue without subteams'

  return (
    <Kb.Modal
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Create subteams" />,
      }}
      footer={{content: <Kb.Button fullWidth={true} label={continueLabel} onClick={onContinue} />}}
      allowOverflow={true}
      backgroundStyle={styles.bg}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.Icon type="icon-illustration-teams-subteams-460-96" />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySmall">
          Subteams are cryptographically distinct, and can welcome people who aren’t elsewhere in your team
          hierarchy.
        </Kb.Text>
        {subteams.map((value, idx) => (
          <Kb.NewInput
            value={value}
            onChangeText={text => setSubteam(idx, cleanSubteamName(text))}
            decoration={<Kb.Icon type="iconfont-remove" onClick={() => onClear(idx)} />}
            placeholder="subteam"
            prefix={`${teamname}.`}
            containerStyle={styles.input}
            maxLength={16}
            key={idx}
          />
        ))}
        <Kb.Button mode="Secondary" icon="iconfont-new" onClick={onAdd} style={styles.addButton} />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addButton: Styles.platformStyles({
    isElectron: {width: 42},
    isMobile: {width: 47},
    isTablet: {alignSelf: 'flex-start'},
  }),
  banner: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  bg: {backgroundColor: Styles.globalColors.blueGrey},
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
    },
    isElectron: {minHeight: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
}))

export default CreateSubteams
