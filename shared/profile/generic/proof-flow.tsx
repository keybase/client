import * as C from '@/constants'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {openDialog, type Dialog} from '@/engine/dialog'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import {openURL as openUrl} from '@/util/misc'
import {normalizeProofUsername} from '../proof-utils'

export type ProveGenericParams = {
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
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

type PickStep = {kind: 'pick'}
type LoadingStep = {kind: 'loading'}
type WebsiteChoiceStep = {kind: 'websiteChoice'}
type EnterUsernameStep = {
  error: string
  kind: 'enterUsername'
  platform: T.More.PlatformsExpandedType
  username: string
}
export type GenericEnterUsernameStep = {
  error: string
  genericParams: ProveGenericParams
  kind: 'genericEnterUsername'
  proofUrl?: string
  service: string
  username: string
}
export type GenericResultStep = {
  error: string
  genericParams: ProveGenericParams
  kind: 'genericResult'
  username: string
}
export type PostProofStep = {
  error: string
  kind: 'postProof'
  platform: T.More.PlatformsExpandedType
  proofText: string
  sigID?: T.RPCGen.SigID
  username: string
}
export type ConfirmOrPendingStep = {
  kind: 'confirmOrPending'
  platform: T.More.PlatformsExpandedType
  proofFound: boolean
  proofStatus?: T.RPCGen.ProofStatus
  username: string
}
export type Step =
  | PickStep
  | LoadingStep
  | WebsiteChoiceStep
  | EnterUsernameStep
  | GenericEnterUsernameStep
  | GenericResultStep
  | PostProofStep
  | ConfirmOrPendingStep

export const checkProofAndNavigate = async (
  proofPlatform: T.More.PlatformsExpandedType,
  sigID: T.RPCGen.SigID,
  username: string,
  proofText: string,
  setStep: (next: Step) => void
) => {
  try {
    const {found, status} = await T.RPCGen.proveCheckProofRpcPromise({sigID}, C.waitingKeyProfile)
    if (!found && status >= T.RPCGen.ProofStatus.baseHardError) {
      setStep({
        error: "We couldn't find your proof. Please retry!",
        kind: 'postProof',
        platform: proofPlatform,
        proofText,
        sigID,
        username,
      })
    } else {
      setStep({
        kind: 'confirmOrPending',
        platform: proofPlatform,
        proofFound: found,
        proofStatus: status,
        username,
      })
    }
  } catch {
    logger.warn('Error getting proof update')
    setStep({
      error: "We couldn't verify your proof. Please retry!",
      kind: 'postProof',
      platform: proofPlatform,
      proofText,
      sigID,
      username,
    })
  }
}

const promptUsername = 'keybase.1.proveUi.promptUsername'
const outputInstructions = 'keybase.1.proveUi.outputInstructions'

export type ProofDialog = Dialog<
  T.RPCGen.StartProofResult,
  typeof promptUsername | typeof outputInstructions,
  'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.outputPrechecks'
>

// Runs one proof on a dialog. The screen shows each step through setStep and answers the username and
// post-proof prompts through the returned submits.
export const runProofFlow = (p: {
  genericService: string | null
  loadCurrentProfile: () => void
  navigateAppend: typeof C.Router2.navigateAppend
  navigateUp: typeof C.Router2.navigateUp
  proofPlatform: string
  proofReason: 'appLink' | 'profile'
  service: T.More.PlatformsExpandedType | undefined
  setStep: (next: Step) => void
}) => {
  const {genericService, loadCurrentProfile, navigateAppend, navigateUp, proofPlatform, proofReason, service, setStep} =
    p

  let username = ''
  let genericParams = makeProveGenericParams()
  let proofText = ''

  const dialog: ProofDialog = openDialog(
    'keybase.1.prove.startProof',
    {
      auto: false,
      force: true,
      promptPosted: !!genericService,
      service: proofPlatform,
      username: '',
    },
    {
      autoAnswer: {
        'keybase.1.proveUi.checking': () => {},
        'keybase.1.proveUi.continueChecking': () => true,
        'keybase.1.proveUi.okToCheck': () => true,
        'keybase.1.proveUi.preProofWarning': () => true,
        'keybase.1.proveUi.promptOverwrite': () => true,
      },
      // The service logs "Success!" here; the global handler writes it to the log
      globalFallthrough: ['keybase.1.logUi.log'],
      notices: ['keybase.1.proveUi.displayRecheckWarning', 'keybase.1.proveUi.outputPrechecks'],
      prompts: [promptUsername, outputInstructions],
      waitingKey: C.waitingKeyProfile,
    }
  )

  const showPrompts = async () => {
    for await (const e of dialog.events) {
      // A dispose between the dequeue and here closed it
      if (e.kind !== 'prompt' || !e.open) {
        continue
      }
      if (e.method === promptUsername) {
        const {parameters, prevError} = e.params
        if (service) {
          setStep({error: prevError?.desc ?? '', kind: 'enterUsername', platform: service, username})
        } else if (genericService && parameters) {
          genericParams = toProveGenericParams(parameters)
          setStep({
            error: prevError?.desc ?? '',
            genericParams,
            kind: 'genericEnterUsername',
            service: genericService,
            username,
          })
        }
      } else {
        const {proof} = e.params
        if (service && proof) {
          proofText = proof
          setStep({error: '', kind: 'postProof', platform: service, proofText: proof, username})
        } else if (proof) {
          setStep({
            error: '',
            genericParams,
            kind: 'genericEnterUsername',
            proofUrl: proof,
            service: genericService ?? '',
            username,
          })
          void openUrl(proof)
          e.answer()
        }
      }
    }
  }

  const run = async () => {
    try {
      const [, {sigID}] = await Promise.all([showPrompts(), dialog.done])
      loadCurrentProfile()
      if (dialog.disposed) {
        return
      }
      if (service) {
        ignorePromise(checkProofAndNavigate(service, sigID, username, proofText, setStep))
      } else {
        setStep({error: '', genericParams, kind: 'genericResult', username})
      }
    } catch (error) {
      loadCurrentProfile()
      if (dialog.disposed || !(error instanceof RPCError)) {
        return
      }
      logger.warn('Error making proof')
      if (genericService) {
        setStep({error: error.desc || 'Failed to verify proof', genericParams, kind: 'genericResult', username})
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
    }
  }

  // The username is kept even with no prompt open, so the next prompt shows it
  const submitUsername = (input: string) => {
    username = input
    const prompt = dialog.openPrompt(promptUsername)
    if (!prompt) {
      return
    }
    username = normalizeProofUsername(service, input).normalized
    prompt.answer(username)
  }

  // false when no instructions are waiting on the user
  const submitPostProof = () => dialog.openPrompt(outputInstructions)?.answer() ?? false

  return {dialog, finished: run(), submitPostProof, submitUsername}
}

export type ProofFlow = ReturnType<typeof runProofFlow>
