import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {makeInsertMatcher} from '@/util/string'
import {useColorScheme} from 'react-native'
import Modal from '../modal'
import {SiteIcon} from './shared'
import {normalizeProofUsername} from '../proof-utils'
import {openURL as openUrl} from '@/util/misc'
import {subtitle} from '@/util/platforms'
import {useCurrentUserState} from '@/stores/current-user'
import {ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {navToProfile} from '@/constants/router'
import {copyToClipboard} from '@/util/storeless-actions'
import {useProofSuggestions} from '../use-proof-suggestions'
import {useTrackerProfile} from '@/tracker/use-profile'

type ProveGenericParams = {
  buttonLabel: string
  logoBlack: T.Tracker.SiteIconSet
  logoFull: T.Tracker.SiteIconSet
  subtext: string
  suffix: string
  title: string
}

const makeProveGenericParams = (): ProveGenericParams => ({
  buttonLabel: '',
  logoBlack: [],
  logoFull: [],
  subtext: '',
  suffix: '',
  title: '',
})

const toProveGenericParams = (p: T.RPCGen.ProveParameters): ProveGenericParams => ({
  ...makeProveGenericParams(),
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

type Props = {
  platform?: string
  reason?: 'appLink' | 'profile'
}

type Provider = {
  desc: string
  icon: T.Tracker.SiteIconSet
  key: string
  name: string
  new: boolean
}

type PickStep = {kind: 'pick'}
type LoadingStep = {kind: 'loading'}
type WebsiteChoiceStep = {kind: 'websiteChoice'}
type EnterUsernameStep = {
  error: string
  kind: 'enterUsername'
  platform: T.More.PlatformsExpandedType
  username: string
}
type GenericEnterUsernameStep = {
  error: string
  genericParams: ProveGenericParams
  kind: 'genericEnterUsername'
  proofUrl?: string
  service: string
  username: string
}
type GenericResultStep = {
  error: string
  genericParams: ProveGenericParams
  kind: 'genericResult'
  username: string
}
type PostProofStep = {
  error: string
  kind: 'postProof'
  platform: T.More.PlatformsExpandedType
  proofText: string
  sigID?: T.RPCGen.SigID
  username: string
}
type ConfirmOrPendingStep = {
  kind: 'confirmOrPending'
  platform: T.More.PlatformsExpandedType
  proofFound: boolean
  proofStatus?: T.RPCGen.ProofStatus
  username: string
}
type Step =
  | PickStep
  | LoadingStep
  | WebsiteChoiceStep
  | EnterUsernameStep
  | GenericEnterUsernameStep
  | GenericResultStep
  | PostProofStep
  | ConfirmOrPendingStep

const Container = ({platform, reason = 'profile'}: Props) => {
  const currentUsername = useCurrentUserState(s => s.username)
  const {proofSuggestions} = useProofSuggestions()
  const {loadProfile} = useTrackerProfile(currentUsername)
  const registerCryptoAddress = C.useRPC(T.RPCGen.cryptocurrencyRegisterAddressRpcPromise)
  const isDarkMode = useColorScheme() === 'dark'
  const {clearModals, navigateAppend, navigateUp} = C.Router2
  const loadCurrentProfile = React.useCallback(() => loadProfile(false), [loadProfile])

  const providers = proofSuggestions.map(s => ({
    desc: s.pickerSubtext,
    icon: isDarkMode ? s.siteIconFullDarkmode : s.siteIconFull,
    key: s.assertionKey,
    name: s.pickerText,
    new: s.metas.some(({label}) => label === 'new'),
  }))

  const mountedRef = React.useRef(true)
  const initialProofStartedRef = React.useRef(false)
  const initialRouteRef = React.useRef({platform, reason})
  const currentUsernameRef = React.useRef('')
  const currentGenericParamsRef = React.useRef(makeProveGenericParams())
  const afterCheckProofRef = React.useRef<undefined | (() => void)>(undefined)
  const cancelCurrentRef = React.useRef<undefined | (() => void)>(undefined)
  const submitUsernameRef = React.useRef<undefined | ((username: string) => void)>(undefined)
  const [step, setStep] = React.useState<Step>(platform ? {kind: 'loading'} : {kind: 'pick'})

  const setStepSafe = (next: Step) => {
    if (mountedRef.current) {
      setStep(next)
    }
  }

  const resetSession = () => {
    afterCheckProofRef.current = undefined
    cancelCurrentRef.current = undefined
    submitUsernameRef.current = undefined
    currentGenericParamsRef.current = makeProveGenericParams()
    currentUsernameRef.current = ''
  }

  const cancelSession = () => {
    const cancel = cancelCurrentRef.current
    resetSession()
    cancel?.()
  }

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const cancel = cancelCurrentRef.current
      afterCheckProofRef.current = undefined
      cancelCurrentRef.current = undefined
      submitUsernameRef.current = undefined
      currentGenericParamsRef.current = makeProveGenericParams()
      currentUsernameRef.current = ''
      cancel?.()
    }
  }, [])

  const closeModal = () => {
    cancelSession()
    navigateUp()
  }

  const closeToProfile = () => {
    cancelSession()
    clearModals()
    navToProfile(currentUsername)
  }

  const checkProofAndNavigate = async (
    proofPlatform: T.More.PlatformsExpandedType,
    sigID: T.RPCGen.SigID,
    username: string,
    proofText: string
  ) => {
    try {
      const {found, status} = await T.RPCGen.proveCheckProofRpcPromise({sigID}, C.waitingKeyProfile)
      if (!mountedRef.current) return
      if (!found && status >= T.RPCGen.ProofStatus.baseHardError) {
        setStepSafe({
          error: "We couldn't find your proof. Please retry!",
          kind: 'postProof',
          platform: proofPlatform,
          proofText,
          sigID,
          username,
        })
      } else {
        setStepSafe({
          kind: 'confirmOrPending',
          platform: proofPlatform,
          proofFound: found,
          proofStatus: status,
          username,
        })
      }
    } catch {
      logger.warn('Error getting proof update')
      setStepSafe({
        error: "We couldn't verify your proof. Please retry!",
        kind: 'postProof',
        platform: proofPlatform,
        proofText,
        sigID,
        username,
      })
    }
  }

  const startProof = (proofPlatform: string, proofReason: 'appLink' | 'profile') => {
    const service = T.More.asPlatformsExpandedType(proofPlatform)
    const genericService = service ? null : proofPlatform

    switch (service) {
      case 'dnsOrGenericWebSite':
        setStepSafe({kind: 'websiteChoice'})
        return
      case 'zcash':
      case 'btc':
        setStepSafe({error: '', kind: 'enterUsername', platform: service, username: ''})
        return
      case 'pgp':
        navigateAppend({name: 'profilePgp', params: {}})
        return
      default:
        break
    }

    setStepSafe({kind: 'loading'})

    const inputCancelError = {
      code: T.RPCGen.StatusCode.scinputcanceled,
      desc: 'Cancel Add Proof',
    }

    let canceled = false
    let proofText = ''
    currentUsernameRef.current = ''
    currentGenericParamsRef.current = makeProveGenericParams()

    const failIfCanceled = (response: {error: (arg0: {code: number; desc: string}) => void}) => {
      if (canceled || !mountedRef.current) {
        response.error(inputCancelError)
        return true
      }
      return false
    }

    ignorePromise(
      (async () => {
        try {
          const {sigID} = await T.RPCGen.proveStartProofRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.proveUi.checking': (_, response) => {
                if (failIfCanceled(response)) {
                  return
                }
                response.result()
              },
              'keybase.1.proveUi.continueChecking': (_, response) =>
                response.result(!(canceled || !mountedRef.current)),
              'keybase.1.proveUi.okToCheck': (_, response) => response.result(true),
              'keybase.1.proveUi.outputInstructions': ({proof}, response) => {
                if (failIfCanceled(response)) {
                  return
                }
                afterCheckProofRef.current = () => {
                  afterCheckProofRef.current = undefined
                  response.result()
                }
                cancelCurrentRef.current = () => {
                  canceled = true
                  response.error(inputCancelError)
                }

                if (service && proof) {
                  proofText = proof
                  setStepSafe({
                    error: '',
                    kind: 'postProof',
                    platform: service,
                    proofText: proof,
                    username: currentUsernameRef.current,
                  })
                } else if (proof) {
                  const genericParams = currentGenericParamsRef.current
                  setStepSafe({
                    error: '',
                    genericParams,
                    kind: 'genericEnterUsername',
                    proofUrl: proof,
                    service: genericService ?? '',
                    username: currentUsernameRef.current,
                  })
                  openUrl(proof)
                  afterCheckProofRef.current()
                }
              },
              'keybase.1.proveUi.preProofWarning': (_, response) => response.result(true),
              'keybase.1.proveUi.promptOverwrite': (_, response) => response.result(true),
              'keybase.1.proveUi.promptUsername': (args, response) => {
                if (failIfCanceled(response)) {
                  return
                }
                const {parameters, prevError} = args
                cancelCurrentRef.current = () => {
                  canceled = true
                  response.error(inputCancelError)
                }
                submitUsernameRef.current = (username: string) => {
                  const {normalized} = normalizeProofUsername(service, username)
                  currentUsernameRef.current = normalized
                  submitUsernameRef.current = undefined
                  response.result(normalized)
                }
                if (service) {
                  setStepSafe({
                    error: prevError?.desc ?? '',
                    kind: 'enterUsername',
                    platform: service,
                    username: currentUsernameRef.current,
                  })
                  cancelCurrentRef.current = () => {
                    canceled = true
                    response.error(inputCancelError)
                  }
                } else if (genericService && parameters) {
                  currentGenericParamsRef.current = toProveGenericParams(parameters)
                  setStepSafe({
                    error: prevError?.desc ?? '',
                    genericParams: currentGenericParamsRef.current,
                    kind: 'genericEnterUsername',
                    service: genericService,
                    username: currentUsernameRef.current,
                  })
                }
                afterCheckProofRef.current = undefined
              },
            },
            incomingCallMap: {
              'keybase.1.proveUi.displayRecheckWarning': () => {},
              'keybase.1.proveUi.outputPrechecks': () => {},
            },
            params: {
              auto: false,
              force: true,
              promptPosted: !!genericService,
              service: proofPlatform,
              username: '',
            },
            waitingKey: C.waitingKeyProfile,
          })

          loadCurrentProfile()

          if (service) {
            ignorePromise(checkProofAndNavigate(service, sigID, currentUsernameRef.current, proofText))
          } else {
            setStepSafe({
              error: '',
              genericParams: currentGenericParamsRef.current,
              kind: 'genericResult',
              username: currentUsernameRef.current,
            })
          }
        } catch (_error) {
          loadCurrentProfile()
          if (!(_error instanceof RPCError)) {
            return
          }
          const error = _error
          logger.warn('Error making proof')

          if (genericService) {
            setStepSafe({
              error: error.desc || 'Failed to verify proof',
              genericParams: currentGenericParamsRef.current,
              kind: 'genericResult',
              username: currentUsernameRef.current,
            })
          } else if (proofReason === 'appLink' && error.code === T.RPCGen.StatusCode.scgeneric) {
            navigateUp()
            navigateAppend({
              name: 'keybaseLinkError',
              params: {
                error:
                  "We couldn't find a valid service for proofs in this link. The link might be bad, or your Keybase app might be out of date and need to be updated.",
              },
            })
          }
        } finally {
          resetSession()
        }
      })()
    )
  }

  const onSubmitProofUsername = (proofPlatform: T.More.PlatformsExpandedType, input: string) => {
    const {normalized, valid} = normalizeProofUsername(proofPlatform, input)

    if (proofPlatform === 'btc') {
      if (!valid) {
        setStepSafe({error: 'Invalid address format', kind: 'enterUsername', platform: proofPlatform, username: input})
        return
      }
      registerCryptoAddress(
        [{address: normalized, force: true, wantedFamily: 'bitcoin'}, C.waitingKeyProfile],
        () => {
          setStepSafe({
            kind: 'confirmOrPending',
            platform: proofPlatform,
            proofFound: true,
            proofStatus: T.RPCGen.ProofStatus.ok,
            username: normalized,
          })
          loadCurrentProfile()
        },
        error => {
          setStepSafe({error: error.desc, kind: 'enterUsername', platform: proofPlatform, username: input})
        }
      )
      return
    }

    if (proofPlatform === 'zcash') {
      registerCryptoAddress(
        [{address: normalized, force: true, wantedFamily: 'zcash'}, C.waitingKeyProfile],
        () => {
          setStepSafe({
            kind: 'confirmOrPending',
            platform: proofPlatform,
            proofFound: true,
            proofStatus: T.RPCGen.ProofStatus.ok,
            username: normalized,
          })
          loadCurrentProfile()
        },
        error => {
          setStepSafe({error: error.desc, kind: 'enterUsername', platform: proofPlatform, username: input})
        }
      )
      return
    }

    currentUsernameRef.current = normalized
    if (!submitUsernameRef.current) {
      return
    }
    submitUsernameRef.current(normalized)
  }

  const startProofEvent = React.useEffectEvent(startProof)

  React.useEffect(() => {
    const {platform: initialPlatform, reason: initialReason} = initialRouteRef.current
    if (initialPlatform && !initialProofStartedRef.current) {
      initialProofStartedRef.current = true
      startProofEvent(initialPlatform, initialReason)
    }
  }, [])

  const content = (() => {
    switch (step.kind) {
      case 'loading':
        return (
          <Modal onCancel={closeModal} skipButton={true}>
            <Kb.Box2 direction="vertical" alignItems="center" gap="small" fullWidth={true}>
              <Kb.ProgressIndicator />
              <Kb.Text center={true} type="Body">
                Starting proof...
              </Kb.Text>
            </Kb.Box2>
          </Modal>
        )
      case 'websiteChoice':
        return (
          <Modal onCancel={closeModal}>
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text center={true} type="Header">
                Prove your website in two ways:
              </Kb.Text>
              <Kb.ChoiceList
                options={[
                  {
                    description: 'Host a text file on your site, such as yoursite.com/keybase.txt.',
                    icon: 'icon-file-txt-48',
                    onClick: () => startProof('web', 'profile'),
                    title: 'Host a TXT file',
                  },
                  {
                    description: 'Place a Keybase proof in your DNS records.',
                    icon: 'icon-dns-48',
                    onClick: () => startProof('dns', 'profile'),
                    title: 'Set a DNS',
                  },
                ]}
              />
            </Kb.Box2>
          </Modal>
        )
      case 'enterUsername':
        return (
          <EnterUsername
            error={step.error}
            onCancel={closeModal}
            onSubmit={onSubmitProofUsername}
            platform={step.platform}
            username={step.username}
          />
        )
      case 'postProof':
        return (
          <PostProof
            copyToClipboard={copyToClipboard}
            onCancel={closeModal}
            onSubmit={() => {
              if (afterCheckProofRef.current) {
                const submit = afterCheckProofRef.current
                afterCheckProofRef.current = undefined
                submit()
                return
              }
              if (step.sigID) {
                ignorePromise(checkProofAndNavigate(step.platform, step.sigID, step.username, step.proofText))
              }
            }}
            step={step}
          />
        )
      case 'confirmOrPending':
        return <ConfirmOrPending onClose={closeToProfile} step={step} />
      case 'genericEnterUsername':
        return (
          <GenericEnterUsername
            onCancel={closeModal}
            onSubmit={username => {
              if (step.proofUrl) {
                openUrl(step.proofUrl)
                return
              }
              currentUsernameRef.current = username
              if (!submitUsernameRef.current) {
                return
              }
              submitUsernameRef.current(username)
            }}
            step={step}
          />
        )
      case 'genericResult':
        return <GenericResult onClose={closeToProfile} step={step} />
      case 'pick':
        return <ProviderPicker onCancel={closeModal} onSelect={key => startProof(key, 'profile')} providers={providers} />
    }
  })()

  return <>{content}</>
}

const ProviderPicker = ({
  onCancel,
  onSelect,
  providers,
}: {
  onCancel: () => void
  onSelect: (key: string) => void
  providers: Array<Provider>
}) => {
  const [filter, setFilter] = React.useState('')
  const itemHeight = {
    height: Kb.Styles.isMobile ? 56 : 48,
    type: 'fixed',
  } as const
  const filterRegexp = makeInsertMatcher(filter)
  const items = (() => {
    const exact: Array<Provider> = []
    const inexact: Array<Provider> = []
    providers.forEach(p => {
      if (p.name === filter) {
        exact.push(p)
      } else if (filterProvider(p, filterRegexp)) {
        inexact.push(p)
      }
    })
    return [...exact, ...inexact]
  })()

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.mobileFlex}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Input3
          autoFocus={true}
          containerStyle={styles.inputContainer}
          hideBorder={true}
          icon="iconfont-search"
          inputStyle={styles.text}
          onChangeText={setFilter}
          placeholder={`Search ${providers.length} platforms`}
          value={filter}
        />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
          <Kb.BoxGrow2>
            <Kb.List
              itemHeight={itemHeight}
              items={items}
              keyProperty="key"
              renderItem={(_: unknown, provider: Provider) => (
                <React.Fragment key={provider.name}>
                  <Kb.Divider />
                  <Kb.ClickableBox
                    className="hover_background_color_blueLighter2"
                    onClick={() => onSelect(provider.key)}
                    style={styles.containerBox}
                  >
                    <SiteIcon full={true} set={provider.icon} style={styles.icon} />
                    <Kb.Box2 direction="vertical" fullWidth={true}>
                      <Kb.Text type="BodySemibold" style={styles.title}>
                        {provider.name}
                      </Kb.Text>
                      {(provider.new || !!provider.desc) && (
                        <Kb.Box2 direction="horizontal" alignItems="flex-start" fullWidth={true}>
                          {provider.new && (
                            <Kb.Meta title="NEW" backgroundColor={Kb.Styles.globalColors.blue} style={styles.new} />
                          )}
                          <Kb.Text type="BodySmall" style={styles.description}>
                            {provider.desc}
                          </Kb.Text>
                        </Kb.Box2>
                      )}
                    </Kb.Box2>
                    <Kb.Icon
                      color={Kb.Styles.globalColors.black_50}
                      fontSize={Kb.Styles.isMobile ? 20 : 16}
                      style={styles.iconArrow}
                      type="iconfont-arrow-right"
                    />
                  </Kb.ClickableBox>
                </React.Fragment>
              )}
            />
          </Kb.BoxGrow2>
          <Kb.Divider />
          <Kb.Box2 direction="horizontal" justifyContent="center" fullWidth={true} style={styles.providerButtonBar}>
            <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const EnterUsername = ({
  error,
  onCancel,
  onSubmit,
  platform,
  username: initialUsername,
}: {
  error: string
  onCancel: () => void
  onSubmit: (platform: T.More.PlatformsExpandedType, username: string) => void
  platform: T.More.PlatformsExpandedType
  username: string
}) => {
  const [usernameState, setUsernameState] = React.useState({
    initialUsername,
    username: initialUsername,
  })
  const normalizedError = error === 'Input canceled' ? '' : error
  const [errorState, setErrorState] = React.useState({error, errorText: normalizedError})

  if (usernameState.initialUsername !== initialUsername) {
    setUsernameState({initialUsername, username: initialUsername})
  }

  if (errorState.error !== error) {
    setErrorState({error, errorText: normalizedError})
  }

  const username =
    usernameState.initialUsername === initialUsername ? usernameState.username : initialUsername
  const setUsername = (username: string) => setUsernameState(state => ({...state, username}))
  const errorText = errorState.error === error ? errorState.errorText : normalizedError
  const setErrorText = (errorText: string) => setErrorState(state => ({...state, errorText}))
  const canSubmit = !!username.length
  const submit = () => {
    if (!canSubmit) {
      return
    }
    setErrorText('')
    onSubmit(platform, username)
  }

  const pt = platformText[platform]
  if (!pt.headerText) {
    throw new Error(`Proofs for platform ${platform} are unsupported.`)
  }

  return (
    <Modal onCancel={onCancel} skipButton={true}>
      {!!errorText && (
        <Kb.Box2 direction="vertical" gap="small" style={styles.error} fullWidth={true}>
          <Kb.Text center={true} negative={true} type="BodySemibold">
            {errorText}
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
        {C.isMobile ? null : (
          <Kb.Text center={true} type="Header">
            {pt.headerText}
          </Kb.Text>
        )}
        <Kb.PlatformIcon
          style={styles.centered}
          platform={platform}
          overlay="icon-proof-unfinished"
          overlayColor={Kb.Styles.globalColors.greyDark}
        />
        <Kb.Input3
          autoFocus={true}
          onChangeText={setUsername}
          onEnterKeyDown={submit}
          placeholder={pt.hintText}
          value={username}
        />
        <UsernameTips platform={platform} />
        <Kb.Box2 direction="horizontal" gap="small">
          <Kb.WaitingButton
            waitingKey={C.waitingKeyProfile}
            onlyDisable={true}
            type="Dim"
            onClick={onCancel}
            label="Cancel"
          />
          <Kb.WaitingButton
            waitingKey={C.waitingKeyProfile}
            disabled={!canSubmit}
            onClick={submit}
            label="Continue"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Modal>
  )
}

const GenericEnterUsername = ({
  onCancel,
  onSubmit,
  step,
}: {
  onCancel: () => void
  onSubmit: (username: string) => void
  step: GenericEnterUsernameStep
}) => {
  const [usernameState, setUsernameState] = React.useState({
    stepUsername: step.username,
    username: step.username,
  })

  if (usernameState.stepUsername !== step.username) {
    setUsernameState({stepUsername: step.username, username: step.username})
  }

  const username = usernameState.stepUsername === step.username ? usernameState.username : step.username
  const setUsername = (username: string) => setUsernameState(state => ({...state, username}))
  const unreachable = !!step.proofUrl
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      {!unreachable && !Kb.Styles.isMobile && <Kb.BackButton onClick={onCancel} style={styles.backButton} />}
      <Kb.Box2 alignItems="center" direction="vertical" gap="xtiny" style={styles.serviceIconHeaderContainer}>
        <Kb.Box2 direction="vertical" relative={true}>
          <SiteIcon set={step.genericParams.logoFull} full={true} style={styles.serviceIconFull} />
          <Kb.IconAuto
            type={unreachable ? 'icon-proof-broken' : 'icon-proof-unfinished'}
            style={styles.serviceProofIcon}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" alignItems="center" style={styles.serviceMeta}>
          <Kb.Text type="BodySemibold">{step.genericParams.title}</Kb.Text>
          <Kb.Text type="BodySmall" center={true}>
            {step.genericParams.subtext}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2
        fullWidth={true}
        direction="vertical"
        alignItems="flex-start"
        gap="xtiny"
        justifyContent="center"
        flex={1}
        style={styles.inputContainerWrap}
      >
        {unreachable ? (
          <Unreachable
            serviceIcon={step.genericParams.logoBlack}
            serviceSuffix={step.genericParams.suffix}
            username={username}
          />
        ) : (
          <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true}>
            <SiteIcon
              set={step.genericParams.logoBlack}
              full={false}
              style={username ? styles.opacity75 : styles.opacity40}
            />
            <Kb.Input3
              autoFocus={true}
              decoration={
                <Kb.Text type="BodySemibold" style={styles.placeholderService}>
                  {step.genericParams.suffix}
                </Kb.Text>
              }
              error={!!step.error}
              onChangeText={setUsername}
              onEnterKeyDown={() => onSubmit(username)}
              placeholder={
                step.genericParams.suffix === '@theqrl.org' ? 'Your QRL address' : 'Your username'
              }
              value={username}
            />
          </Kb.Box2>
        )}
        {!!step.error && <Kb.Text type="BodySmallError">{step.error}</Kb.Text>}
      </Kb.Box2>
      <Kb.Box2
        alignItems="center"
        fullWidth={true}
        direction="vertical"
        style={unreachable ? styles.buttonBarWarning : null}
      >
        {unreachable && (
          <Kb.Text type="BodySmallSemibold" center={true} style={styles.warningText}>
            You need to authorize your proof on {step.genericParams.title}.
          </Kb.Text>
        )}
        <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
          {!Kb.Styles.isMobile && !unreachable && (
            <Kb.Button type="Dim" onClick={onCancel} label="Cancel" style={styles.buttonSmall} />
          )}
          {unreachable ? (
            <Kb.Button
              type="Success"
              onClick={() => onSubmit(username)}
              label={step.genericParams.buttonLabel}
              style={styles.buttonBig}
            />
          ) : (
            <Kb.WaitingButton
              type="Success"
              onClick={() => onSubmit(username)}
              label={step.genericParams.buttonLabel}
              style={styles.buttonBig}
              waitingKey={C.waitingKeyProfile}
            />
          )}
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const PostProof = ({
  copyToClipboard,
  onCancel,
  onSubmit,
  step,
}: {
  copyToClipboard: (text: string) => void
  onCancel: () => void
  onSubmit: () => void
  step: PostProofStep
}) => {
  let proofText = step.proofText
  let url = ''
  let openLinkBeforeSubmit = false
  switch (step.platform) {
    case 'twitter':
      openLinkBeforeSubmit = true
      url = proofText ? `https://twitter.com/home?status=${proofText}` : ''
      break
    case 'github':
      openLinkBeforeSubmit = true
      url = 'https://gist.github.com/'
      break
    case 'reddit':
    case 'facebook':
      openLinkBeforeSubmit = true
      url = proofText
      proofText = ''
      break
    case 'hackernews':
      openLinkBeforeSubmit = true
      url = `https://news.ycombinator.com/user?id=${step.username}`
      break
    default:
      break
  }

  const [showSubmit, setShowSubmit] = React.useState(!openLinkBeforeSubmit)
  const platformSubtitle = subtitle(step.platform)
  const proofActionText = actionMap.get(step.platform) ?? ''
  const onCompleteText = checkMap.get(step.platform) ?? 'OK posted! Check for it!'
  const noteText = noteMap.get(step.platform) ?? ''
  const DescriptionView = descriptionMap[step.platform] ?? EmptyDescription

  return (
    <Modal onCancel={onCancel} skipButton={true}>
      <Kb.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        key={step.error || 'scroll'}
      >
        <Kb.Box2
          direction="vertical"
          gap="small"
          onCopyCapture={e => {
            e.preventDefault()
            if (proofText) {
              copyToClipboard(proofText)
            }
          }}
        >
          {!!step.error && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.error}>
              <Kb.Text center={true} negative={true} type="BodySemibold">
                {step.error}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.PlatformIcon
            platform={step.platform}
            style={styles.center}
            overlay="icon-proof-unfinished"
            overlayColor={Kb.Styles.globalColors.greyDark}
          />
          <>
            <Kb.Text center={true} style={styles.blue} type="Header">
              {step.username}
            </Kb.Text>
            {!!platformSubtitle && (
              <Kb.Text center={true} style={styles.grey} type="Body">
                {platformSubtitle}
              </Kb.Text>
            )}
          </>
          <DescriptionView platformUserName={step.username} />
          {!!proofText && <Kb.CopyableText style={styles.proof} value={proofText} />}
          {!!noteText && (
            <Kb.Text center={true} type="Body">
              {noteText}
            </Kb.Text>
          )}
          <Kb.Box2 direction={Kb.Styles.isMobile ? 'verticalReverse' : 'horizontal'} gap="small">
            <Kb.Button type="Dim" onClick={onCancel} label="Cancel" />
            {showSubmit ? (
              <Kb.WaitingButton
                onClick={onSubmit}
                label={onCompleteText}
                waitingKey={C.waitingKeyProfile}
              />
            ) : (
              <Kb.Button
                onClick={() => {
                  setShowSubmit(true)
                  if (url) {
                    openUrl(url)
                  }
                }}
                label={proofActionText}
              />
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ScrollView>
    </Modal>
  )
}

const ConfirmOrPending = ({
  onClose,
  step,
}: {
  onClose: () => void
  step: ConfirmOrPendingStep
}) => {
  const isGood = step.proofFound && step.proofStatus === T.RPCGen.ProofStatus.ok
  const isPending =
    !isGood &&
    !step.proofFound &&
    !!step.proofStatus &&
    step.proofStatus <= T.RPCGen.ProofStatus.baseHardError
  const platformIconOverlayColor = isGood ? Kb.Styles.globalColors.green : Kb.Styles.globalColors.greyDark
  const platformIconOverlay = isPending ? 'icon-proof-pending' : 'icon-proof-success'
  const platformSubtitle = subtitle(step.platform)
  const title = isPending ? 'Your proof is pending.' : 'Verified!'
  const message =
    messageMap.get(step.platform) ||
    (isPending
      ? 'Some proofs can take a few hours to recognize. Check back later.'
      : 'Leave your proof up so other users can identify you!')

  return (
    <Modal onCancel={onClose} skipButton={true}>
      <Kb.Box2 direction="vertical" gap="small">
        <Kb.Text negative={true} type="BodySemibold">
          {title}
        </Kb.Text>
        <Kb.PlatformIcon
          style={styles.center}
          platform={step.platform}
          overlay={platformIconOverlay}
          overlayColor={platformIconOverlayColor}
        />
        <>
          <Kb.Text center={true} type="Header" style={styles.blue}>
            {step.username}
          </Kb.Text>
          {platformSubtitle && (
            <Kb.Text center={true} type="Body" style={styles.grey}>
              {platformSubtitle}
            </Kb.Text>
          )}
        </>
        <Kb.Text center={true} type="Body">
          {message}
        </Kb.Text>
        {step.platform === 'http' && (
          <Kb.Text center={true} type="BodySmall">
            Note: {step.username} doesn&apos;t load over https. If you get a real SSL certificate
            (not self-signed) in the future, please replace this proof with a fresh one.
          </Kb.Text>
        )}
        <Kb.Button onClick={onClose} label="Reload profile" />
      </Kb.Box2>
    </Modal>
  )
}

const GenericResult = ({
  onClose,
  step,
}: {
  onClose: () => void
  step: GenericResultStep
}) => {
  const proofUsername = step.username + step.genericParams.suffix
  const success = !step.error
  const iconType = success ? 'icon-proof-success' : 'icon-proof-broken'
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        alignItems="center"
        fullWidth={true}
        style={styles.topContainer}
      >
        <Kb.Box2 direction="vertical" style={styles.serviceIconContainer}>
          <SiteIcon set={step.genericParams.logoFull} full={true} />
          <Kb.Box2 direction="vertical" style={styles.iconBadgeContainer}>
            <Kb.ImageIcon type={iconType} />
          </Kb.Box2>
        </Kb.Box2>
        {success ? (
          <>
            <Kb.Text type="Body">You are provably</Kb.Text>
            <Kb.Text type="BodySemibold">{proofUsername}</Kb.Text>
          </>
        ) : (
          <Kb.Text type="Body">{step.error}</Kb.Text>
        )}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.bottomContainer}>
        <Kb.Button type="Dim" label="Close and reload Profile" onClick={onClose} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const Unreachable = ({
  serviceIcon,
  serviceSuffix,
  username,
}: {
  serviceIcon: T.Tracker.SiteIconSet
  serviceSuffix: string
  username: string
}) => (
  <Kb.Box2
    direction="horizontal"
    gap="xtiny"
    alignItems="flex-start"
    style={Kb.Styles.collapseStyles([styles.inputBox, styles.unreachableBox])}
    fullWidth={Kb.Styles.isMobile}
  >
    <SiteIcon
      set={serviceIcon}
      full={false}
      style={Kb.Styles.collapseStyles([styles.opacity75, styles.inlineIcon])}
    />
    <Kb.Box2 direction="vertical" flex={1}>
      <Kb.Text type="BodySemibold" style={styles.unreachablePlaceholder}>
        <Kb.Text type="BodySemibold" style={styles.colorRed}>
          {username}
        </Kb.Text>
        {serviceSuffix}
      </Kb.Text>
      <Kb.Meta title="unreachable" backgroundColor={Kb.Styles.globalColors.red} />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.marginLeftAuto}>
      <Kb.Icon
        type="iconfont-proof-broken"
        color={Kb.Styles.globalColors.red}
        style={styles.inlineIcon}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const UsernameTips = ({platform}: {platform: T.More.PlatformsExpandedType}) =>
  platform === 'hackernews' ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tips}>
      <Kb.Text type="BodySmallSemibold">&bull; You must have karma &ge; 2</Kb.Text>
      <Kb.Text type="BodySmallSemibold">&bull; You must enter your uSeRName with exact case</Kb.Text>
    </Kb.Box2>
  ) : null

const standardText = (name: string) => ({
  headerText: C.isMobile ? `Prove ${name}` : `Prove your ${name} identity`,
  hintText: `Your ${name} username`,
})

const invalidText = () => ({
  headerText: '',
  hintText: '',
})

const platformText = {
  btc: {headerText: 'Set a Bitcoin address', hintText: 'Your Bitcoin address'},
  dns: {headerText: 'Prove your domain', hintText: 'yourdomain.com'},
  dnsOrGenericWebSite: invalidText(),
  facebook: standardText('Facebook'),
  github: standardText('GitHub'),
  hackernews: standardText('Hacker News'),
  http: {headerText: 'Prove your http website', hintText: 'http://whatever.yoursite.com'},
  https: {headerText: 'Prove your https website', hintText: 'https://whatever.yoursite.com'},
  pgp: invalidText(),
  reddit: standardText('Reddit'),
  rooter: invalidText(),
  twitter: standardText('Twitter'),
  web: {headerText: 'Prove your website', hintText: 'whatever.yoursite.com'},
  zcash: {headerText: 'Set a Zcash address', hintText: 'Your z_address or t_address'},
}

const actionMap = new Map([
  ['github', 'Create gist now'],
  ['hackernews', 'Go to Hacker News'],
  ['reddit', 'Reddit form'],
  ['twitter', 'Tweet it now'],
])

const checkMap = new Map([['twitter', 'OK tweeted! Check for it!']])

const webNote = 'Note: If someone already verified this domain, just append to the existing keybase.txt file.'

const noteMap = new Map([
  ['http', webNote],
  ['https', webNote],
  ['reddit', "Make sure you're signed in to Reddit, and don't edit the text or title before submitting."],
  ['web', webNote],
])

const WebDescription = ({platformUserName}: {platformUserName: string}) => {
  const root = `${platformUserName}/keybase.txt`
  const wellKnown = `${platformUserName}/.well-known/keybase.txt`
  const rootUrlProps = Kb.useClickURL(`https://${root}`)
  const wellKnownUrlProps = Kb.useClickURL(`https://${wellKnown}`)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text center={true} type="BodySemibold">
        Please serve the text below <Kb.Text type="BodySemiboldItalic">exactly as it appears</Kb.Text>
        {" at one of these URL's."}
      </Kb.Text>
      <Kb.Text
        type="BodyPrimaryLink"
        center={true}
        {...rootUrlProps}
        style={{color: Kb.Styles.globalColors.blueDark, marginTop: Kb.Styles.globalMargins.tiny}}
      >
        {root}
      </Kb.Text>
      <Kb.Text
        type="BodyPrimaryLink"
        center={true}
        {...wellKnownUrlProps}
        style={{color: Kb.Styles.globalColors.blueDark}}
      >
        {wellKnown}
      </Kb.Text>
    </Kb.Box2>
  )
}

const EmptyDescription = () => null

const descriptionMap: Partial<
  Record<T.More.PlatformsExpandedType, React.ComponentType<{platformUserName: string}>>
> = {
  dns: () => (
    <Kb.Text center={true} type="BodySemibold">
      Enter the following as a TXT entry in your DNS zone, <Kb.Text type="BodySemibold">exactly as it appears</Kb.Text>
      {'. If you need a "name" for your entry, give it "@".'}
    </Kb.Text>
  ),
  facebook: () => null,
  github: () => (
    <Kb.Text center={true} type="BodySemibold">
      Login to GitHub and paste the text below into a <Kb.Text type="BodySemiboldItalic">public</Kb.Text> gist
      called <Kb.Text type="BodySemiboldItalic">keybase.md.</Kb.Text>
    </Kb.Text>
  ),
  hackernews: () => (
    <Kb.Text center={true} type="BodySemibold">
      Please add the below text <Kb.Text type="BodySemibold" style={Kb.Styles.globalStyles.italic}>exactly as it appears</Kb.Text>{' '}
      to your profile.
    </Kb.Text>
  ),
  http: WebDescription,
  https: WebDescription,
  reddit: () => (
    <Kb.Text center={true} type="BodySemibold">
      Click the button below and post the form in the subreddit <Kb.Text type="BodySemiboldItalic">KeybaseProofs</Kb.Text>.
    </Kb.Text>
  ),
  rooter: () => null,
  twitter: () => (
    <Kb.Text center={true} type="BodySemibold">
      Click the button below and tweet the text exactly as it appears.
    </Kb.Text>
  ),
  web: WebDescription,
}

const messageMap = new Map([
  ['btc', 'Your Bitcoin address has now been signed onto your profile.'],
  ['dns', 'DNS proofs can take a few hours to recognize. Check back later.'],
  [
    'hackernews',
    'Hacker News caches its bios, so it might be a few hours before you can verify your proof. Check back later.',
  ],
  ['zcash', 'Your Zcash address has now been signed onto your profile.'],
])

const normalizeForFiltering = (input: string) => input.toLowerCase().replace(/[.\s]/g, '')
const filterProvider = (p: Provider, filter: RegExp) =>
  normalizeForFiltering(p.name).search(filter) !== -1 || normalizeForFiltering(p.desc).search(filter) !== -1

const rightColumnStyle = Kb.Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        left: Kb.Styles.globalMargins.small,
        position: 'absolute',
        top: Kb.Styles.globalMargins.small,
      },
      blue: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.blueDark},
        isElectron: {wordBreak: 'break-all'},
      }),
      bottomContainer: {height: 80},
      buttonBar: {
        ...Kb.Styles.padding(
          Kb.Styles.globalMargins.small,
          Kb.Styles.globalMargins.medium,
          Kb.Styles.globalMargins.medium
        ),
      },
      buttonBarWarning: {backgroundColor: Kb.Styles.globalColors.yellow},
      buttonBig: {flex: 2.5},
      buttonSmall: {flex: 1},
      center: {alignSelf: 'center'},
      centered: {alignSelf: 'center'},
      colorRed: {color: Kb.Styles.globalColors.redDark},
      container: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          borderRadius: 4,
          overflow: 'hidden',
        },
        isMobile: {
          width: '100%',
        },
      }),
      containerBox: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        height: Kb.Styles.isMobile ? 56 : 48,
        justifyContent: 'flex-start',
      },
      description: {...rightColumnStyle},
      error: {
        backgroundColor: Kb.Styles.globalColors.red,
        borderRadius: Kb.Styles.borderRadius,
        marginBottom: Kb.Styles.globalMargins.small,
        padding: Kb.Styles.globalMargins.medium,
      },
      grey: {color: Kb.Styles.globalColors.black_20},
      icon: {
        height: 32,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        width: 32,
      },
      iconArrow: {marginRight: Kb.Styles.globalMargins.small},
      iconBadgeContainer: {
        bottom: -5,
        position: 'absolute',
        right: -5,
      },
      inlineIcon: {
        position: 'relative',
        top: 1,
      },
      inputBox: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small),
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid' as const,
        borderWidth: 1,
        minHeight: 40,
      },
      inputContainer: {
        alignSelf: 'stretch',
        backgroundColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        marginBottom: Kb.Styles.globalMargins.xsmall,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.xsmall,
        padding: Kb.Styles.globalMargins.tiny,
        width: 'auto',
      },
      inputContainerWrap: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.medium),
      },
      listContainer: {flex: 1},
      marginLeftAuto: {marginLeft: 'auto'},
      mobileFlex: {flex: 1},
      new: {
        marginRight: Kb.Styles.globalMargins.xtiny,
        marginTop: 1,
      },
      opacity40: {opacity: 0.4},
      opacity75: {opacity: 0.75},
      placeholderService: {
        color: Kb.Styles.globalColors.black_50,
      },
      proof: {
        maxWidth: '100%',
      },
      providerButtonBar: {
        padding: Kb.Styles.globalMargins.medium,
      },
      scroll: {maxWidth: '100%'},
      scrollContent: {
        paddingBottom: Kb.Styles.globalMargins.small,
      },
      serviceIconContainer: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        position: 'relative',
      },
      serviceIconFull: {
        height: 64,
        width: 64,
      },
      serviceIconHeaderContainer: {
        marginTop: Kb.Styles.globalMargins.medium,
      },
      serviceMeta: {
        maxWidth: 320,
      },
      serviceProofIcon: {
        bottom: -8,
        position: 'absolute',
        right: -8,
      },
      text: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        color: Kb.Styles.globalColors.black_50,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      tips: {padding: Kb.Styles.globalMargins.small},
      title: {
        ...rightColumnStyle,
        color: Kb.Styles.globalColors.black,
      },
      topContainer: {flex: 1},
      unreachableBox: {
        backgroundColor: Kb.Styles.globalColors.black_05,
      },
      unreachablePlaceholder: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Kb.Styles.globalMargins.xtiny,
      },
      warningText: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.medium, 0),
      },
    }) as const
)

export default Container
