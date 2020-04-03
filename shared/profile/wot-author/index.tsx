import * as React from 'react'
import {WebOfTrustVerificationType} from '../../constants/types/more'
import * as Constants from '../../constants/profile'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

// PICNIC-1059 Keep in sync with server limit (yet to be implemented)
const statementLimit = 700
const otherLimit = 90

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

const WotModal = (props: WotModalProps) => {
  const dispatch = Container.useDispatch()
  const onClose = () => dispatch(RouteTreeGen.createClearModals())
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

type Question1Props = {
  error?: string
  initialVerificationType: WebOfTrustVerificationType
  onSubmit: (_: {
    otherText: string
    proofs: {key: string; value: string}[]
    verificationType: WebOfTrustVerificationType
  }) => void
  proofs: {key: string; value: string}[]
  voucheeUsername: string
}

export const Question1 = (props: Question1Props) => {
  const scrollViewRef = React.useRef<Kb.ScrollView>(null)
  const [selectedVt, _setVt] = React.useState<WebOfTrustVerificationType>(props.initialVerificationType)
  const [otherText, setOtherText] = React.useState('')
  const setVt = newVt => {
    if (newVt === 'other' && newVt !== selectedVt && scrollViewRef.current) {
      const hackDelay = 50 // With no delay scrolling undershoots. Perhaps the bottom component doesn't exist yet.
      setTimeout(() => scrollViewRef.current?.scrollToEnd({animated: true}), hackDelay)
    }
    _setVt(newVt)
  }
  const proofs = useCheckboxesState(props.proofs)
  const submitDisabled =
    (selectedVt === 'other' && otherText === '') || (selectedVt === 'proofs' && !proofs.some(x => x.checked))
  const onSubmit = () => {
    props.onSubmit({
      otherText: selectedVt === 'other' ? otherText : '',
      proofs: proofs
        .filter(({checked}) => checked)
        .map(proof => ({
          key: proof.key,
          value: proof.value,
        })),
      verificationType: selectedVt,
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
            type="BodySemibold"
            inline={true}
            colorFollowing={true}
            colorBroken={true}
          />{' '}
          is the person you think they are?
        </Kb.Text>
      </Kb.Box2>
      {Constants.choosableWotVerificationTypes
        .filter(vtLoop => vtLoop !== 'proofs' || proofs.length)
        .map(vtLoop => (
          <VerificationChoice
            key={vtLoop}
            voucheeUsername={props.voucheeUsername}
            verificationType={vtLoop}
            selected={selectedVt === vtLoop}
            onSelect={() => setVt(vtLoop)}
          >
            {/* For 'proofs': Show a row for each proof */}
            {vtLoop === 'proofs' && <ProofList selected={selectedVt === 'proofs'} proofs={proofs} />}
            {/* For 'other': Show an input area when active */}
            {vtLoop === 'other' && selectedVt === vtLoop && (
              <OtherInput otherText={otherText} setOtherText={setOtherText} />
            )}
          </VerificationChoice>
        ))}
    </WotModal>
  )
}

type Question2Props = {
  error?: string
  onBack: () => void
  onSubmit: ({statement: string}) => void
  waiting?: boolean
  voucheeUsername: string
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
              type="BodySemibold"
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

const ProofList = (props: {
  selected: boolean
  proofs: {key: string; value: string; checked: boolean; onCheck: (_: boolean) => void}[]
}) => (
  <>
    {props.proofs.map(proof => (
      <Kb.Box2
        key={`${proof.key}:${proof.value}`}
        direction="horizontal"
        alignSelf="stretch"
        alignItems="center"
        style={styles.insetContainer}
      >
        <Kb.Checkbox
          checked={proof.checked && props.selected}
          onCheck={proof.onCheck}
          disabled={!props.selected}
          labelComponent={
            <Kb.Text type="Body">
              {proof.value}@{proof.key}
            </Kb.Text>
          }
        />
      </Kb.Box2>
    ))}
  </>
)

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
function useCheckboxesState<T>(items: T[]): (T & {checked: boolean; onCheck: (_: boolean) => void})[] {
  const [stateStored, setState] = React.useState<boolean[]>(items.map(() => false))
  const state = items.length === stateStored.length ? stateStored : items.map(() => false)
  return items.map((item, i) => ({
    ...item,
    checked: state[i],
    onCheck: checked => {
      setState(state.map((wasChecked, j) => (i === j ? checked : wasChecked)))
    },
  }))
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
      sidePadding: {paddingLeft: Styles.globalMargins.small, paddingRight: Styles.globalMargins.small},
      topIconContainer: {backgroundColor: Styles.globalColors.green, overflow: 'hidden'},
    } as const)
)
