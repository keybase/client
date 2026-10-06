import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {Props} from './index.shared'
import useHook from './hooks'

const CreateChannel = (p: Props) => {
  const desktopStyles = useDesktopStyles()
  const nativeStyles = useNativeStyles()
  const props = useHook(p)

  if (!isMobile) {
    return (
      <>
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={desktopStyles.boxTop}>
          <Kb.Avatar isTeam={true} teamname={props.teamname} size={32} />
          <Kb.Text type="BodySmallSemibold" style={desktopStyles.teamname}>
            {props.teamname}
          </Kb.Text>
        </Kb.Box2>
        {!!props.errorText && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
          </Kb.Banner>
        )}
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={desktopStyles.box}>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" gapEnd={true} gapStart={true}>
            <Kb.Input3
              textType="BodySemibold"
              autoFocus={true}
              placeholder="Channel name"
              value={props.channelname}
              onEnterKeyDown={props.onSubmit}
              onChangeText={props.onChannelnameChange}
            />
            <Kb.Input3
              textType="BodySemibold"
              autoFocus={false}
              autoCorrect={true}
              autoCapitalize="sentences"
              multiline={true}
              rowsMin={1}
              rowsMax={10}
              maxLength={280}
              placeholder="Add a description or topic..."
              value={props.description}
              onEnterKeyDown={props.onSubmit}
              onChangeText={props.onDescriptionChange}
            />
          </Kb.Box2>
          <Kb.ConfirmButtons
            waitingKey={C.waitingKeyTeamsCreateChannel(props.teamID)}
            onCancel={props.onBack}
            onConfirm={props.onSubmit}
            confirmLabel="Save"
          />
        </Kb.Box2>
      </>
    )
  }

  return (
    <>
      {!!props.errorText && (
        <Kb.Banner color="red">
          <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
        </Kb.Banner>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={nativeStyles.box}>
        <Kb.Box2 direction="vertical" gap="small">
          <Kb.Input3
            textType="BodySemibold"
            autoFocus={true}
            placeholder="Channel name"
            value={props.channelname}
            onChangeText={props.onChannelnameChange}
          />
          <Kb.Input3
            textType="BodySemibold"
            autoCorrect={true}
            autoFocus={false}
            autoCapitalize="sentences"
            multiline={true}
            rowsMin={1}
            rowsMax={2}
            maxLength={280}
            placeholder="Add a description or topic..."
            value={props.description}
            onChangeText={props.onDescriptionChange}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} style={buttonBarStyle}>
          <Kb.WaitingButton
            waitingKey={C.waitingKeyTeamsCreateChannel(props.teamID)}
            onClick={props.onSubmit}
            label="Save"
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const buttonBarStyle = {alignItems: 'center'} as const

const useDesktopStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      box: {
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
      },
      boxTop: {
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
        paddingTop: Kb.Styles.globalMargins.medium,
      },
      teamname: {...Kb.Styles.marginV(Kb.Styles.globalMargins.xtiny)},
    }) as const
)

const useNativeStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      box: {padding: 16},
    }) as const
)

export default CreateChannel
