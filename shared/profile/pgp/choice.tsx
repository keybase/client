import * as Kb from '@/common-adapters'
import PlatformIcon from '@/profile/platform-icon'
import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {produce} from 'immer'
import {RPCError} from '@/util/errors'
import {openDialog, type Dialog} from '@/engine/dialog'
import Modal from '@/profile/modal'
import * as Validators from '@/util/simple-validators'

type GeneratePgpArgs = {
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpFullName: string
}

export const validatePgpInfo = (info: GeneratePgpArgs) => {
  const email1Error = Validators.isValidEmail(info.pgpEmail1)
  const email2Error = info.pgpEmail2 ? Validators.isValidEmail(info.pgpEmail2) : ''
  const email3Error = info.pgpEmail3 ? Validators.isValidEmail(info.pgpEmail3) : ''
  const nameError = Validators.isValidName(info.pgpFullName)

  return {
    pgpErrorEmail1: !!email1Error,
    pgpErrorEmail2: !!email2Error,
    pgpErrorEmail3: !!email3Error,
    pgpErrorText: nameError || email1Error || email2Error || email3Error,
  }
}

type FinishedStep = {kind: 'finished'; pgpKeyString: string; promptShouldStoreKeyOnServer: boolean}
type Step = {kind: 'choice'} | {kind: 'info'} | {kind: 'generate'} | FinishedStep

const makeInitialForm = (): GeneratePgpArgs => ({
  pgpEmail1: '',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpFullName: '',
})

const pushPrivate = 'keybase.1.pgpUi.shouldPushPrivate'

export type PgpDialog = Dialog<void, typeof pushPrivate, 'keybase.1.pgpUi.finished'>

// onFinished shows the key; the finished step answers the dialog's shouldPushPrivate prompt with
// whether to store it on the server
export const generatePgp = (args: GeneratePgpArgs, onFinished: (next: FinishedStep) => void) => {
  let pgpKeyString = 'Error getting public key...'
  const ids = [args.pgpEmail1, args.pgpEmail2, args.pgpEmail3].filter(Boolean).map(email => ({
    comment: '',
    email,
    username: args.pgpFullName,
  }))
  const dialog: PgpDialog = openDialog(
    'keybase.1.pgp.pgpKeyGenDefault',
    {createUids: {ids, useDefault: false}},
    {
      autoAnswer: {
        'keybase.1.pgpUi.keyGenerated': ({key}) => {
          pgpKeyString = key.key
        },
      },
      // The service logs key generation progress; the global handler writes it to the log. Storing the
      // key on the server can need the password, which desktop pinentry answers globally.
      globalFallthrough: ['keybase.1.logUi.log', 'keybase.1.secretUi.getPassphrase'],
      notices: ['keybase.1.pgpUi.finished'],
      prompts: [pushPrivate],
    }
  )
  const showPrompts = async () => {
    for await (const e of dialog.events) {
      // A dispose between the dequeue and here closed it
      if (e.kind === 'prompt' && e.open) {
        onFinished({kind: 'finished', pgpKeyString, promptShouldStoreKeyOnServer: e.params.prompt})
      }
    }
  }
  const run = async () => {
    try {
      await Promise.all([showPrompts(), dialog.done])
    } catch (error) {
      if (dialog.disposed || !(error instanceof RPCError)) {
        return
      }
      if (error.code !== T.RPCGen.StatusCode.scinputcanceled) {
        throw error
      }
    }
  }
  return {dialog, finished: run()}
}

export const PgpMobileUnsupported = ({onCancel}: {onCancel: () => void}) => (
  <Modal onCancel={onCancel}>
    <Kb.Box2 direction="vertical" gap="small" gapEnd={true}>
      <Kb.Text center={true} type="Header">
        Add a PGP key
      </Kb.Text>
      <Kb.Text type="Body">For now, please use our desktop app to create PGP keys.</Kb.Text>
    </Kb.Box2>
  </Modal>
)

export default function Choice() {
  const styles = useStyles()
  const {clearModals, navigateAppend, navigateUp} = C.Router2
  const dialogRef = React.useRef<PgpDialog | undefined>(undefined)
  const [form, setForm] = React.useState(makeInitialForm)
  const [step, setStep] = React.useState<Step>({kind: 'choice'})

  React.useEffect(
    () => () => {
      dialogRef.current?.dispose()
    },
    []
  )

  if (isMobile) {
    return <PgpMobileUnsupported onCancel={() => navigateUp()} />
  }

  const onCancel = () => {
    if (step.kind === 'info') {
      setStep({kind: 'choice'})
      return
    }
    if (step.kind === 'generate') {
      dialogRef.current?.dispose()
    }
    clearModals()
  }

  const onShowGetNew = () => {
    setStep({kind: 'info'})
  }
  const onShowImport = () => {
    navigateAppend({name: 'profileImport', params: {}})
  }

  const onUpdate = (next: Partial<GeneratePgpArgs>) => {
    setForm(
      produce(draft => {
        Object.assign(draft, next)
      })
    )
  }

  const data = {...form, ...validatePgpInfo(form)}
  const nextDisabled = !data.pgpEmail1 || !data.pgpFullName || !!data.pgpErrorText

  const onGenerate = () => {
    if (nextDisabled) {
      return
    }
    setStep({kind: 'generate'})
    const {dialog, finished} = generatePgp(form, setStep)
    dialogRef.current = dialog
    ignorePromise(finished)
  }

  const content = (() => {
    switch (step.kind) {
      case 'choice':
        return (
          <Kb.Box2 direction="vertical" gap="small">
            <Kb.Text type="Header">Add a PGP key</Kb.Text>
            <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
              <Kb.ListItem
                type="Card"
                firstItem={true}
                icon={<Kb.IconAuto type="icon-pgp-key-new-48" />}
                body={
                  <Kb.Box2 direction="vertical" fullWidth={true}>
                    <Kb.Text type="BodyBigLink">Get a new PGP key</Kb.Text>
                    <Kb.Text type="Body">
                      Keybase will generate a new PGP key and add it to your profile.
                    </Kb.Text>
                  </Kb.Box2>
                }
                onClick={onShowGetNew}
              />
              <Kb.ListItem
                type="Card"
                firstItem={true}
                icon={<Kb.IconAuto type="icon-pgp-key-import-48" />}
                body={
                  <Kb.Box2 direction="vertical" fullWidth={true}>
                    <Kb.Text type="BodyBigLink">I have one already</Kb.Text>
                    <Kb.Text type="Body">Import an existing PGP key to your Keybase profile.</Kb.Text>
                  </Kb.Box2>
                }
                onClick={onShowImport}
              />
            </Kb.Box2>
          </Kb.Box2>
        )
      case 'info':
        return (
          <>
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" flex={1}>
              <PlatformIcon platform="pgp" overlay="icon-proof-unfinished" style={styles.centered} />
              <Kb.Text type="BodySemibold" style={styles.centered}>
                Fill in your public info.
              </Kb.Text>
              <Kb.Input3
                textType="BodySemibold"
                autoFocus={true}
                placeholder="Your full name"
                value={data.pgpFullName}
                onChangeText={pgpFullName => onUpdate({pgpFullName})}
              />
              <Kb.Input3
                textType="BodySemibold"
                placeholder="Email 1"
                onChangeText={pgpEmail1 => onUpdate({pgpEmail1})}
                onEnterKeyDown={onGenerate}
                value={data.pgpEmail1}
                error={data.pgpErrorEmail1}
              />
              <Kb.Input3
                textType="BodySemibold"
                placeholder="Email 2 (optional)"
                onChangeText={pgpEmail2 => onUpdate({pgpEmail2})}
                onEnterKeyDown={onGenerate}
                value={data.pgpEmail2}
                error={data.pgpErrorEmail2}
              />
              <Kb.Input3
                textType="BodySemibold"
                placeholder="Email 3 (optional)"
                onChangeText={pgpEmail3 => onUpdate({pgpEmail3})}
                onEnterKeyDown={onGenerate}
                value={data.pgpEmail3}
                error={data.pgpErrorEmail3}
              />
              <Kb.Text type={data.pgpErrorText ? 'BodySmallError' : 'BodySmall'}>
                {data.pgpErrorText || 'Include any addresses you plan to use for PGP encrypted email.'}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 fullWidth={true} direction="horizontal" gap="small">
              <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
              <Kb.Button
                label="Let the math begin"
                disabled={nextDisabled}
                onClick={onGenerate}
                style={styles.math}
              />
            </Kb.Box2>
          </>
        )
      case 'generate':
        return (
          <Kb.Box2 direction="vertical" gap="small" alignItems="center">
            <PlatformIcon platform="pgp" overlay="icon-proof-unfinished" />
            <Kb.Text type="Header">Generating your unique key...</Kb.Text>
            <Kb.Text type="Body">
              Math time! You are about to discover a 4096-bit key pair.
              <br />
              This could take as long as a couple of minutes.
            </Kb.Text>
            <Kb.Animation animationType="loadingInfinity" height={100} width={100} />
          </Kb.Box2>
        )
      case 'finished':
        return (
          <Finished
            onDone={shouldStoreKeyOnServer => {
              dialogRef.current?.openPrompt(pushPrivate)?.answer(shouldStoreKeyOnServer)
              // Storing the key may still ask for the password (desktop pinentry answers it), so
              // leaving now must not dispose the dialog
              dialogRef.current = undefined
              clearModals()
            }}
            pgpKeyString={step.pgpKeyString}
            promptShouldStoreKeyOnServer={step.promptShouldStoreKeyOnServer}
          />
        )
    }
  })()

  const skipButton = step.kind === 'info' || step.kind === 'finished'
  return (
    <Modal onCancel={onCancel} skipButton={skipButton}>
      {content}
    </Modal>
  )
}

const Finished = (props: {
  onDone: (shouldStoreKeyOnServer: boolean) => void
  promptShouldStoreKeyOnServer: boolean
  pgpKeyString: string
}) => {
  const styles = useStyles()
  const {onDone} = props
  const [shouldStoreKeyOnServer, setShouldStoreKeyOnServer] = React.useState(false)

  return (
    <Kb.Box2 direction="vertical" alignItems="center" gap="tiny">
      <PlatformIcon platform="pgp" overlay="icon-proof-success" />
      <Kb.Text type="Header">Here is your unique public key!</Kb.Text>
      <Kb.Text type="Body">
        {
          "Your private key has been written to Keybase's local keychain. You can learn to use it with `keybase pgp help` from your terminal. If you have GPG installed, it has also been written to GPG's keychain."
        }
      </Kb.Text>
      {isMobile ? null : (
        <textarea
          style={Kb.Styles.castStyleDesktop(styles.pgpKeyString)}
          readOnly={true}
          value={props.pgpKeyString}
        />
      )}
      {props.promptShouldStoreKeyOnServer && (
        <Kb.Box2 direction="vertical">
          <Kb.Checkbox
            onCheck={setShouldStoreKeyOnServer}
            checked={shouldStoreKeyOnServer}
            label="Store encrypted private key on Keybase's server"
          />
          <Kb.Text type="BodySmall">
            Allows you to download & import your key to other devices. You might need to enter your Keybase
            password.{' '}
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Button
        onClick={() => onDone(shouldStoreKeyOnServer)}
        label={shouldStoreKeyOnServer ? 'Done, post to Keybase' : 'Done'}
      />
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      centered: {alignSelf: 'center'},
      math: {flexGrow: 1},
      pgpKeyString: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fontTerminal,
          backgroundColor: theme.greyLight,
          border: `solid 1px ${theme.black_10}`,
          ...Kb.Styles.globalStyles.rounded,
          color: theme.black,
          flexGrow: 1,
          fontSize: 12,
          lineHeight: 17,
          minHeight: 116,
          overflowX: 'hidden',
          overflowY: 'auto',
          padding: 10,
          textAlign: 'left',
          userSelect: 'all',
          whiteSpace: 'pre-wrap',
          width: '100%',
          wordWrap: 'break-word',
        } as const,
      }),
    }) as const
)
