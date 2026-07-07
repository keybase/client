import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {Props} from './index.shared'
import useHook from './hooks'

const CreateChannel = (p: Props) => {
  const props = useHook(p)

  if (!isMobile) {
    return (
      <>
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={desktopStyles.boxTop}>
          <Kb.Avatar isTeam={true} teamname={props.teamname} size={32} />
          <Kb.Text type="BodySmallSemibold" style={{marginTop: Kb.Styles.globalMargins.xtiny}}>
            {props.teamname}
          </Kb.Text>
          <Kb.Text
            type="Header"
            style={{
              ...Kb.Styles.marginV(Kb.Styles.globalMargins.tiny),
            }}
          >
            New chat channel
          </Kb.Text>
        </Kb.Box2>
        {!!props.errorText && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
          </Kb.Banner>
        )}
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={desktopStyles.box}>
          <Kb.ClickableBox direction="horizontal" alignItems="center" style={desktopStyles.back} onClick={props.onBack}>
            <Kb.Icon style={desktopStyles.backIcon} type="iconfont-arrow-left" />
            <Kb.Text type="BodyPrimaryLink">Back</Kb.Text>
          </Kb.ClickableBox>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" gapEnd={true} gapStart={true}>
            <Kb.Input3
              autoFocus={true}
              placeholder="Channel name"
              value={props.channelname}
              onEnterKeyDown={props.onSubmit}
              onChangeText={props.onChannelnameChange}
            />
            <Kb.Input3
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
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
          <Kb.Input3
            autoFocus={true}
            placeholder="Channel name"
            value={props.channelname}
            onChangeText={props.onChannelnameChange}
          />
          <Kb.Input3
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

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      back: {
        left: 32,
        position: 'absolute',
        top: 32,
      },
      backIcon: {marginRight: Kb.Styles.globalMargins.xtiny},
      box: {
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
      },
      boxTop: {
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
        paddingTop: Kb.Styles.globalMargins.medium,
      },
    }) as const
)

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: {padding: 16},
    }) as const
)

export default CreateChannel
