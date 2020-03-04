import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {pluralize} from '../../../util/string'
import {ModalTitle} from '../../common'

const cleanSubteamName = (name: string) => name.replace(/[^0-9a-zA-Z_]/, '')

type Props = {
  teamname: string
}

const CreateSubteams = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [subteams, setSubteams] = React.useState<Array<string>>(['', '', ''])
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

  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  const numSubteams = subteams.filter(c => !!c.trim()).length
  const continueLabel = numSubteams
    ? `Continue with ${numSubteams} ${pluralize('subteam', numSubteams)}`
    : 'Continue without subteams'

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={props.teamname} title="Create subteams" />,
      }}
      footer={{content: <Kb.Button fullWidth={true} label={continueLabel} />}}
      allowOverflow={true}
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
        <Kb.Text type="BodySmall">Channels can be joined by anyone in the team, unlike subteams.</Kb.Text>
        {subteams.map((value, idx) => (
          <Kb.NewInput
            value={value}
            onChangeText={text => setSubteam(idx, cleanSubteamName(text))}
            decoration={<Kb.Icon type="iconfont-remove" onClick={() => onClear(idx)} />}
            placeholder="subteam"
            prefix={`${props.teamname}.`}
            containerStyle={styles.input}
            maxLength={16}
            key={idx}
          />
        ))}
        <Kb.Button mode="Secondary" icon="iconfont-new" tooltip="" onClick={onAdd} style={styles.addButton} />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addButton: Styles.platformStyles({
    isElectron: {width: 42},
    isMobile: {width: 47},
  }),
  banner: {
    backgroundColor: Styles.globalColors.blue,
    height: 96,
  },
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {minHeight: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
}))

export default CreateSubteams
