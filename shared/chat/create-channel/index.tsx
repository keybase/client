import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {Props} from './index.shared'
import useHook from './hooks'

const CreateChannel = (p: Props) => {
  const props = useHook(p)

  if (!Kb.Styles.isMobile) {
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
              marginBottom: Kb.Styles.globalMargins.tiny,
              marginTop: Kb.Styles.globalMargins.tiny,
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
          <Kb.ClickableBox style={desktopStyles.back} onClick={props.onBack}>
            <Kb.Icon style={desktopStyles.backIcon} type="iconfont-arrow-left" />
            <Kb.Text type="BodyPrimaryLink">Back</Kb.Text>
          </Kb.ClickableBox>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" gapEnd={true} gapStart={true}>
            <Kb.Input3
              autoFocus={true}
              placeholder="Channel name"
              value={props.channelname}
              onEnterKeyDown={props.onSubmit}
              onChangeText={channelname => props.onChannelnameChange(channelname)}
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
              onChangeText={description => props.onDescriptionChange(description)}
            />
          </Kb.Box2>
          <Kb.ButtonBar fullWidth={true} style={desktopStyles.buttonBar}>
            <Kb.Button type="Dim" onClick={props.onBack} label="Cancel" />
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
            onChangeText={channelname => props.onChannelnameChange(channelname)}
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
            onChangeText={description => props.onDescriptionChange(description)}
          />
        </Kb.Box2>
        <Kb.ButtonBar fullWidth={true} style={nativeStyles.buttonBar}>
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

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      back: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        left: 32,
        position: 'absolute',
        top: 32,
      },
      backIcon: {marginRight: Kb.Styles.globalMargins.xtiny},
      box: {
        paddingLeft: Kb.Styles.globalMargins.large,
        paddingRight: Kb.Styles.globalMargins.large,
      },
      boxTop: {
        paddingLeft: Kb.Styles.globalMargins.large,
        paddingRight: Kb.Styles.globalMargins.large,
        paddingTop: Kb.Styles.globalMargins.medium,
      },
      buttonBar: {alignItems: 'center'},
    }) as const
)

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: {padding: 16},
      buttonBar: {alignItems: 'center'},
    }) as const
)

export default CreateChannel
