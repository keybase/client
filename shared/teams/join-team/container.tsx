import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type {RootParamList} from '@/router-v2/route-params'
import {RPCError} from '@/util/errors'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import upperFirst from 'lodash/upperFirst'
import * as React from 'react'
import {useNavigation} from '@react-navigation/native'

type OwnProps = {initialTeamname?: string; success?: boolean}

const getJoinTeamError = (error: unknown) => {
  if (error instanceof RPCError) {
    return (
      error.code === T.RPCGen.StatusCode.scteaminvitebadtoken
        ? 'Sorry, that team name or token is not valid.'
        : error.code === T.RPCGen.StatusCode.scnotfound
          ? 'This invitation is no longer valid, or has expired.'
          : error.desc
    )
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

const Container = ({initialTeamname, success: successParam}: OwnProps) => {
  const [errorText, setErrorText] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [successTeamName, setSuccessTeamName] = React.useState('')
  const [name, _setName] = React.useState(initialTeamname ?? '')
  const joinTeam = C.useRPC(T.RPCGen.teamsTeamAcceptInviteOrRequestAccessRpcListener)
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList, 'teamJoinTeamDialog'>>()
  const navigateUp = C.Router2.navigateUp
  const success = !!successParam
  const handoffToInviteRef = React.useRef(false)

  const setName = (n: string) => _setName(n.toLowerCase())
  const onBack = () => navigateUp()

  React.useEffect(() => {
    _setName(initialTeamname ?? '')
    setErrorText('')
    setOpen(false)
    setSuccessTeamName('')
    if (successParam) {
      navigation.setParams({initialTeamname, success: false})
    }
  }, [initialTeamname, navigation, successParam])

  const onSubmit = () => {
    setErrorText('')
    setOpen(false)
    setSuccessTeamName('')
    joinTeam(
      [
        {
          customResponseIncomingCallMap: {
            'keybase.1.teamsUi.confirmInviteLinkAccept': (params, response) => {
              handoffToInviteRef.current = true
              C.Router2.navigateAppend(
                {
                  name: 'teamInviteLinkJoin',
                  params: {
                    inviteDetails: params.details,
                    inviteKey: name,
                  },
                },
                true
              )
              response.result(false)
            },
          },
          incomingCallMap: {},
          params: {tokenOrName: name},
          waitingKey: C.waitingKeyTeamsJoinTeam,
        },
      ],
      result => {
        setOpen(result.wasOpenTeam)
        setSuccessTeamName(result.wasTeamName ? name : '')
        navigation.setParams({initialTeamname, success: true})
      },
      error => {
        if (handoffToInviteRef.current) {
          handoffToInviteRef.current = false
          return
        }
        setErrorText(upperFirst(getJoinTeamError(error)))
      }
    )
  }

  return (
    <>
      {errorText ? (
        <Kb.Banner key="red" color="red">
          <Kb.BannerParagraph bannerColor="red" content={errorText} />
        </Kb.Banner>
      ) : null}
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        {success ? (
          <Kb.Box2 alignItems="center" direction="horizontal" fullHeight={true} fullWidth={true}>
            {open ? (
              <Success teamname={successTeamName} />
            ) : (
              <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true}>
                <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
                  <Kb.ImageIcon type="icon-illustration-teams-zen-460-96" />
                </Kb.Box2>
                <Kb.Box2 direction="vertical" style={styles.container}>
                  <Kb.Text center={true} type="Body">
                    Your request was sent to the admins of{' '}
                    {successTeamName ? <Kb.Text type="BodySemibold">{successTeamName}</Kb.Text> : 'the team'}.
                    {"Hang tight, you'll get notified as soon as you're let in."}
                  </Kb.Text>
                </Kb.Box2>
              </Kb.Box2>
            )}
          </Kb.Box2>
        ) : (
          <Kb.Box2 direction="vertical" style={styles.container} gap="tiny">
            <Kb.RoundedBox>
              <Kb.Input3
                autoFocus={true}
                onChangeText={setName}
                onEnterKeyDown={onSubmit}
                placeholder="Token or team name"
                value={name}
                hideBorder={true}
              />
            </Kb.RoundedBox>
            <Kb.Text type="BodySmall">Examples: keybasefriends, stellar.public, etc.</Kb.Text>
          </Kb.Box2>
        )}
      </Kb.ScrollView>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.WaitingButton
            fullWidth={true}
            label={success ? 'Close' : 'Continue'}
            onClick={success ? onBack : onSubmit}
            type={success ? 'Dim' : 'Default'}
            waitingKey={C.waitingKeyTeamsJoinTeam}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

export const Success = (props: {teamname: string}) => (
  <Kb.Box2 alignItems="center" direction="vertical" gap="tiny" style={styles.container}>
    <Kb.ImageIcon type="icon-illustration-welcome-96" />
    {!!props.teamname && (
      <Kb.Text center={true} type="Header">
        You’ve joined {props.teamname}!
      </Kb.Text>
    )}
    <Kb.Text center={true} type="Body">
      The team may take a tiny while to appear as an admin needs to come online. But you’re in.
    </Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: Kb.Styles.platformStyles({isElectron: {overflowX: 'hidden'}}),
      buttonBar: {minHeight: undefined},
      container: {
        padding: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
    }) as const
)

export default Container
