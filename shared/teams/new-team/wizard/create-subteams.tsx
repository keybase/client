import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import {ModalTitle} from '@/teams/common'

const cleanSubteamName = (name: string) => name.replace(/[^0-9a-zA-Z_]/, '')

const CreateSubteams = () => {
  const nav = Container.useSafeNavigation()
  const teamID = T.Teams.newTeamWizardTeamID
  const teamname = C.useTeamsState(s => s.newTeamWizard.name)
  const initialSubteams = C.useTeamsState(s => s.newTeamWizard.subteams) ?? ['', '', '']

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
  const setTeamWizardSubteams = C.useTeamsState(s => s.dispatch.setTeamWizardSubteams)
  const onContinue = () => setTeamWizardSubteams(subteams.filter(s => !!s))
  const onBack = () => nav.safeNavigateUp()

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
        gap={Kb.Styles.isMobile ? 'xsmall' : 'tiny'}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  addButton: Kb.Styles.platformStyles({
    isElectron: {width: 42},
    isMobile: {width: 47},
    isTablet: {alignSelf: 'flex-start'},
  }),
  banner: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  bg: {backgroundColor: Kb.Styles.globalColors.blueGrey},
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
    },
    isElectron: {minHeight: 326},
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  input: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall)},
}))

export default CreateSubteams
