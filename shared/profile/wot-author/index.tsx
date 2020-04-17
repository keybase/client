import * as React from 'react'
import {WebOfTrustVerificationType} from '../../constants/types/more'
import * as Constants from '../../constants/profile'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Tracker2Types from '../../constants/types/tracker2'
import {SiteIcon} from '../../profile/generic/shared'
import * as ProfileGen from '../../actions/profile-gen'
import * as Tracker2Constants from '../../constants/tracker2'
import * as RPCTypes from '../../constants/types/rpc-gen'
import sortBy from 'lodash/sortBy'

// PICNIC-1059 Keep in sync with server limit (yet to be implemented)
const statementLimit = 700
const otherLimit = 90

export type Question1Props = {
  error?: string
  initialVerificationType: WebOfTrustVerificationType
  onSubmit: (_: Question1Answer) => void
  proofs: Array<Proof>
  voucheeUsername: string
}

export type Question1Answer = {
  otherText: string
  proofs: Array<RPCTypes.WotProof>
  verificationType: WebOfTrustVerificationType
}

export type Question2Props = {
  error?: string
  onBack: () => void
  onSubmit: ({statement: string}) => void
  voucheeUsername: string
  waiting?: boolean
}

type WotModalProps = {
  children: React.ReactNode
  error?: string
  onBack?: () => void
  onSubmit: () => void
  scrollViewRef?: React.Ref<Kb.ScrollView>
  submitDisabled?: boolean
  submitLabel: string
  submitWaiting?: boolean
}

export type Proof = {
  type: string
  value: string
  siteIcon?: Tracker2Types.SiteIconSet
  siteIconDarkmode?: Tracker2Types.SiteIconSet
  wotProof: RPCTypes.WotProof
}

type Checkboxed = {
  checked: boolean
  onCheck: (_: boolean) => void
}

export const Question1Wrapper = (
  props: Container.RouteProps<{
    username: string
    guiID: string
  }>
) => {
  const voucheeUsername = Container.getRouteProps(props, 'username', '')
  const guiID = Container.getRouteProps(props, 'guiID', '')
  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  let error = Container.useSelector(state => state.profile.wotAuthorError)
  if (!error && !voucheeUsername) {
    error = 'Routing missing username.'
  }
  const {username: trackerUsername, assertions} = Container.useSelector(state =>
    Tracker2Constants.getDetails(state, voucheeUsername)
  )
  let proofs: Proof[] = []
  if (trackerUsername === voucheeUsername) {
    if (assertions) {
      // Pull proofs from the profile they were just looking at.
      // Only take passing proofs that have a `wotProof` field filled by the service.
      proofs = sortBy(
        Array.from(assertions, ([_, assertion]) => assertion),
        x => x.priority
      ).reduce<Array<Proof>>((acc, x) => {
        if (x.wotProof && x.state === 'valid') {
          acc.push({...x, wotProof: x.wotProof})
        }
        return acc
      }, [])
    }
  } else {
    error = `Proofs not loaded: ${trackerUsername} != ${voucheeUsername}`
  }
  const onSubmit = (answer: Question1Answer) => {
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {guiID, question1Answer: answer, username: voucheeUsername},
            selected: 'profileWotAuthorQ2',
          },
        ],
      })
    )
  }
  return (
    <Question1
      error={error}
      initialVerificationType={'in_person'}
      onSubmit={onSubmit}
      proofs={proofs}
      voucheeUsername={voucheeUsername}
    />
  )
}

export const Question2Wrapper = (
  props: Container.RouteProps<{
    username: string
    guiID: string
    question1Answer: Question1Answer
  }>
) => {
  const voucheeUsername = Container.getRouteProps(props, 'username', '')
  const guiID = Container.getRouteProps(props, 'guiID', '')
  const question1Answer = Container.getRoutePropsOr(props, 'question1Answer', 'error')
  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  let error = Container.useSelector(state => state.profile.wotAuthorError)
  if (!error && !voucheeUsername) {
    error = 'Routing missing username.'
  }
  if (!error && question1Answer === 'error') {
    error = 'Routing missing q1 answer.'
  }
  const waiting = Container.useAnyWaiting(Constants.wotAuthorWaitingKey)
  const onSubmit = ({statement}: {statement: string}) => {
    if (question1Answer === 'error') {
      return
    }
    const {otherText, proofs, verificationType} = question1Answer
    dispatch(
      ProfileGen.createWotVouch({
        guiID,
        otherText,
        proofs,
        statement,
        username: voucheeUsername,
        verificationType,
      })
    )
  }
  const onBack = () => {
    dispatch(ProfileGen.createWotVouchSetError({error: ''}))
    dispatch(nav.safeNavigateUpPayload())
  }
  return (
    <Question2
      error={error}
      onBack={onBack}
      onSubmit={onSubmit}
      voucheeUsername={voucheeUsername}
      waiting={waiting}
    />
  )
}

export const Question1 = (props: Question1Props) => {
  const scrollViewRef = React.useRef<Kb.ScrollView>(null)
  const [selectedVerificationType, _setVerificationType] = React.useState<WebOfTrustVerificationType>(
    props.initialVerificationType
  )
  const [otherText, setOtherText] = React.useState('')
  const [proofs, clearCheckboxes] = useCheckboxesState(props.proofs, () => _setVerificationType('proofs'))
  const setVerificationType = newVerificationType => {
    if (newVerificationType === selectedVerificationType) {
      return
    }
    if (newVerificationType !== 'proofs') {
      clearCheckboxes()
    }
    if (newVerificationType === 'other' && scrollViewRef.current) {
      const hackDelay = 50 // With no delay scrolling undershoots. Perhaps the bottom component doesn't exist yet.
      setTimeout(() => scrollViewRef.current?.scrollToEnd({animated: true}), hackDelay)
    }
    _setVerificationType(newVerificationType)
  }
  const submitDisabled =
    (selectedVerificationType === 'other' && otherText === '') ||
    (selectedVerificationType === 'proofs' && !proofs.some(x => x.checked))
  const onSubmit = () => {
    props.onSubmit({
      otherText: selectedVerificationType === 'other' ? otherText : '',
      proofs: proofs.filter(({checked}) => checked).map(proof => proof.wotProof),
      verificationType: selectedVerificationType,
    })
  }

  return (
    <WotModal
      error={props.error}
      onSubmit={onSubmit}
      scrollViewRef={scrollViewRef}
      submitDisabled={submitDisabled}
      submitLabel="Continue"
    >
      <Kb.Box2
        direction="horizontal"
        alignSelf="stretch"
        alignItems="center"
        style={Styles.collapseStyles([styles.sidePadding, styles.id])}
      >
        <Kb.Avatar username={props.voucheeUsername} size={48} />
        <Kb.Text type="BodySemibold" style={styles.idInner}>
          How do you know{' '}
          <Kb.ConnectedUsernames
            usernames={props.voucheeUsername}
            type="BodyBold"
            inline={true}
            colorFollowing={true}
            colorBroken={true}
          />{' '}
          is the person you think they are?
        </Kb.Text>
      </Kb.Box2>
      {Constants.choosableWotVerificationTypes
        .filter(loopVerificationType => loopVerificationType !== 'proofs' || proofs.length)
        .map(loopVerificationType => (
          <VerificationChoice
            key={loopVerificationType}
            voucheeUsername={props.voucheeUsername}
            verificationType={loopVerificationType}
            selected={selectedVerificationType === loopVerificationType}
            onSelect={() => setVerificationType(loopVerificationType)}
          >
            {/* For 'proofs': Show a row for each proof */}
            {loopVerificationType === 'proofs' && proofList(selectedVerificationType === 'proofs', proofs)}
            {/* For 'other': Show an input area when active */}
            {loopVerificationType === 'other' && selectedVerificationType === loopVerificationType && (
              <OtherInput otherText={otherText} setOtherText={setOtherText} />
            )}
          </VerificationChoice>
        ))}
    </WotModal>
  )
}

export const Question2 = (props: Question2Props) => {
  const [statement, setStatement] = React.useState('')
  const submitDisabled = statement === ''
  const onSubmit = () => props.onSubmit({statement})
  return (
    <WotModal
      error={props.error}
      onBack={props.onBack}
      onSubmit={onSubmit}
      submitDisabled={submitDisabled}
      submitWaiting={props.waiting}
      submitLabel="Submit"
    >
      <Kb.Box2
        direction="vertical"
        alignSelf="stretch"
        alignItems="stretch"
        style={Styles.collapseStyles([styles.sidePadding, styles.outside])}
      >
        <Kb.Box2 direction="horizontal" alignItems="center" style={styles.outsideBox}>
          <Kb.Avatar username={props.voucheeUsername} size={48} />
          <Kb.Text type="BodySemibold" style={styles.idInner}>
            How do you know{' '}
            <Kb.ConnectedUsernames
              usernames={props.voucheeUsername}
              type="BodyBold"
              inline={true}
              colorFollowing={true}
              colorBroken={true}
            />{' '}
            outside of Keybase?
          </Kb.Text>
        </Kb.Box2>
        <Kb.LabeledInput
          placeholder="Your claim"
          hoverPlaceholder={'Write how you met them and what experiences you shared with them.'}
          multiline={true}
          rowsMin={9}
          autoFocus={!Styles.isMobile}
          maxLength={statementLimit}
          value={statement}
          onChangeText={setStatement}
        />
        <Kb.Text type="BodySmall" style={styles.approveNote}>
          {props.voucheeUsername} will be able to approve or suggest edits to what you’ve written.
        </Kb.Text>
      </Kb.Box2>
    </WotModal>
  )
}

const WotModal = (props: WotModalProps) => {
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(ProfileGen.createWotVouchSetError({error: ''}))
    dispatch(RouteTreeGen.createClearModals())
  }
  return (
    <Kb.Modal
      onClose={onClose}
      scrollViewRef={props.scrollViewRef}
      header={{
        leftButton: props.onBack ? (
          <Kb.Text onClick={props.onBack} type="BodyPrimaryLink">
            Back
          </Kb.Text>
        ) : Styles.isMobile ? (
          <Kb.Text onClick={onClose} type="BodyPrimaryLink">
            Cancel
          </Kb.Text>
        ) : (
          undefined
        ),
        title: 'Web of Trust',
      }}
      mode="DefaultFullHeight"
      banners={[
        !!props.error && (
          <Kb.Banner key="error" color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.error} />
          </Kb.Banner>
        ),
      ]}
      footer={{
        content: (
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
            <Kb.Button
              fullWidth={true}
              label={props.submitLabel}
              onClick={props.onSubmit}
              disabled={props.submitDisabled}
              waiting={props.submitWaiting}
            />
          </Kb.ButtonBar>
        ),
      }}
    >
      <Kb.Box2 direction="vertical" alignSelf="stretch" alignItems="center" style={styles.topIconContainer}>
        <Kb.Icon type="icon-illustration-wot-460-96" />
      </Kb.Box2>
      {props.children}
    </Kb.Modal>
  )
}

const VerificationChoice = (props: {
  children?: React.ReactNode
  voucheeUsername: string
  verificationType: WebOfTrustVerificationType
  selected: boolean
  onSelect: () => void
}) => {
  let text: React.ReactNode = 'Do not choose this option'
  let color: string = Styles.globalColors.white
  switch (props.verificationType) {
    case 'in_person':
      text = (
        <>
          {props.voucheeUsername} told me their username <Kb.Text type="BodyBold">in person</Kb.Text>
        </>
      )
      color = Styles.globalColors.greenDark
      break
    case 'video':
      text = `${props.voucheeUsername} told me their username over video`
      color = '#56fff5'
      break
    case 'audio':
      text = `${props.voucheeUsername} told me their username over audio`
      color = Styles.globalColors.blueLight
      break
    case 'proofs':
      text = `I know one of ${props.voucheeUsername}'s proofs`
      color = Styles.globalColors.blueLight
      break
    case 'other_chat':
      text = `${props.voucheeUsername} texted me their username`
      color = Styles.globalColors.yellow
      break
    case 'familiar':
      text = 'We are longtime Keybase friends'
      color = Styles.globalColors.yellow
      break
    case 'other':
      text = 'Other'
      color = Styles.globalColors.yellowDark
      break
  }
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center">
      <Kb.Box2
        key="colorbar"
        direction="vertical"
        alignSelf="stretch"
        style={{backgroundColor: color, flexShrink: 0, width: 6}}
      />
      <Kb.Box2 direction="vertical" alignSelf="stretch" style={Styles.globalStyles.flexOne}>
        <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center">
          <Kb.RadioButton
            label={
              <Kb.Text type="Body" style={Styles.globalStyles.flexOne}>
                {text}
              </Kb.Text>
            }
            selected={props.selected}
            onSelect={props.onSelect}
            style={styles.choiceRadio}
          />
        </Kb.Box2>
        {props.children}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const proofList = (selected: boolean, proofs: Array<Proof & Checkboxed>) =>
  proofs.map(proof => (
    <Kb.Box2
      key={`${proof.type}:${proof.value}`}
      direction="horizontal"
      alignSelf="stretch"
      alignItems="center"
      style={styles.insetContainer}
    >
      <Kb.Checkbox
        checked={proof.checked && selected}
        onCheck={proof.onCheck}
        labelComponent={<ProofSingle {...proof} />}
      />
    </Kb.Box2>
  ))

const ProofSingle = (props: Proof) => {
  let siteIcon: React.ReactNode = null
  const iconSet = Styles.isDarkMode() ? props.siteIconDarkmode : props.siteIcon
  if (iconSet) {
    siteIcon = <SiteIcon full={false} set={iconSet} />
  }
  return (
    <Kb.Box2 direction="horizontal" alignItems="center" style={styles.proofSingle}>
      {siteIcon}
      <Kb.Text type="Body" style={styles.proofSingleValue} lineClamp={1}>
        {props.value}
      </Kb.Text>
      <Kb.Text type="Body">@{props.type}</Kb.Text>
    </Kb.Box2>
  )
}

const OtherInput = (props: {otherText: string; setOtherText: (_: string) => void}) => (
  <Kb.Box2
    direction="vertical"
    alignSelf="stretch"
    alignItems="flex-start"
    style={Styles.collapseStyles([styles.insetContainer, styles.otherInputContainer])}
  >
    <Kb.LabeledInput
      placeholder={'Specify (required)'}
      value={props.otherText}
      onChangeText={props.setOtherText}
      maxLength={otherLimit}
    />
  </Kb.Box2>
)

// Store checkedness for a list of checkboxes.
function useCheckboxesState<T>(items: Array<T>, onCheck: () => void): [Array<T & Checkboxed>, () => void] {
  const [stateStored, setState] = React.useState<Array<boolean>>(items.map(() => false))
  const state = items.length === stateStored.length ? stateStored : items.map(() => false)
  const clear = () => setState(items.map(() => false))
  return [
    items.map((item, i) => ({
      ...item,
      checked: state[i],
      onCheck: checked => {
        setState(state.map((wasChecked, j) => (i === j ? checked : wasChecked)))
        onCheck()
      },
    })),
    clear,
  ]
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      approveNote: {paddingTop: Styles.globalMargins.tiny},
      buttonBar: {minHeight: undefined},
      choiceRadio: {
        flex: 1,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
      },
      id: {paddingBottom: Styles.globalMargins.tiny, paddingTop: Styles.globalMargins.tiny},
      idInner: {
        flex: 1,
        paddingLeft: Styles.globalMargins.tiny,
      },
      insetContainer: Styles.platformStyles({
        common: {marginLeft: 38, marginRight: Styles.globalMargins.small},
        isMobile: {marginLeft: 46},
      }),
      otherInputContainer: {paddingBottom: Styles.globalMargins.tiny},
      outside: {paddingTop: Styles.globalMargins.tiny},
      outsideBox: {paddingBottom: Styles.globalMargins.small},
      proofSingle: {
        flexShrink: 1,
        marginBottom: 2,
        marginLeft: 3,
        marginTop: 0,
      },
      proofSingleValue: {flexShrink: 1, marginLeft: 8},
      sidePadding: {paddingLeft: Styles.globalMargins.small, paddingRight: Styles.globalMargins.small},
      topIconContainer: {backgroundColor: Styles.globalColors.green, overflow: 'hidden'},
    } as const)
)
