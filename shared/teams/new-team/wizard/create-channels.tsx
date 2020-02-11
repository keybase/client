import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'

type Props = {
  teamname: string
}

const CreateChannel = (props: Props) => {
  const dispatch = Container.useDispatch()
  // const nav = Container.useSafeNavigation()

  const onBack = () => {} // dispatch(nav.safeNavigateUpPayload()) TODO mock nav for storybook

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={props.teamname}>Create channels</ModalTitle>,
      }}
      allowOverflow={true}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.Text type="BodySmall">Banner</Kb.Text>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySmall">Channels can be joined by anyone in the team, unlike subteams.</Kb.Text>
        <ChannelInput isGeneral={true} />
      </Kb.Box2>
    </Kb.Modal>
  )
}

type ChannelInputProps =
  | {isGeneral: true}
  | {
      isGeneral: false
      onChange: (value: string) => void
      value: string
    }

const ChannelInput = (props: ChannelInputProps) => {
  if (props.isGeneral) {
    return <Kb.NewInput value="#general" disabled={true} containerStyle={styles.inputGeneral} />
  }
  return <Kb.NewInput value={props.value} onChangeText={props.onChange} containerStyle={styles.input} />
}

const styles = Styles.styleSheetCreate(() => ({
  banner: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blue,
    },
    isElectron: {
      height: 96,
    },
    isMobile: {
      height: 61,
    },
  }),
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {height: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
  inputGeneral: {...Styles.padding(Styles.globalMargins.xsmall), opacity: 0.4},
}))

export default CreateChannel
