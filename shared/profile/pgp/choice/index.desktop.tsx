import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import Modal from '@/profile/modal'
import {validatePgpInfo} from '../validation'

type GeneratePgpArgs = {
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpFullName: string
}

type Step =
  | {kind: 'choice'}
  | {kind: 'info'}
  | {kind: 'generate'}
  | {kind: 'finished'; pgpKeyString: string; promptShouldStoreKeyOnServer: boolean}

const makeInitialForm = (): GeneratePgpArgs => ({
  pgpEmail1: '',
  pgpEmail2: '',
  pgpEmail3: '',
  pgpFullName: '',
})

export default function Choice() {
  const {clearModals, navigateAppend} = C.Router2
  const mountedRef = React.useRef(true)
  const cancelCurrentRef = React.useRef<undefined | (() => void)>(undefined)
  const finishCurrentRef = React.useRef<undefined | ((shouldStoreKeyOnServer: boolean) => void)>(undefined)
  const [form, setForm] = React.useState(makeInitialForm)
  const [step, setStep] = React.useState<Step>({kind: 'choice'})

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const cancel = cancelCurrentRef.current
      cancelCurrentRef.current = undefined
      finishCurrentRef.current = undefined
      cancel?.()
    }
  }, [])

  const setStepSafe = (next: Step) => {
    if (mountedRef.current) {
      setStep(next)
    }
  }

  const onCancel = () => {
    if (step.kind === 'info') {
      setStepSafe({kind: 'choice'})
      return
    }
    if (step.kind === 'generate') {
      cancelCurrentRef.current?.()
    }
    clearModals()
  }

  const onShowGetNew = () => {
    setStepSafe({kind: 'info'})
  }
  const onShowImport = () => {
    navigateAppend('profileImport')
  }

  const onUpdate = (next: Partial<GeneratePgpArgs>) => {
    setForm(s => ({...s, ...next}))
  }

  const data = {...form, ...validatePgpInfo(form)}
  const nextDisabled = !data.pgpEmail1 || !data.pgpFullName || !!data.pgpErrorText

  const onGenerate = () => {
    if (nextDisabled) {
      return
    }
    const args = form
    setStepSafe({kind: 'generate'})

    ignorePromise(
      (async () => {
        let canceled = false
        let pgpKeyString = 'Error getting public key...'
        const inputCancelError = {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}
        const ids = [args.pgpEmail1, args.pgpEmail2, args.pgpEmail3].filter(Boolean).map(email => ({
          comment: '',
          email,
          username: args.pgpFullName,
        }))

        cancelCurrentRef.current = () => {
          canceled = true
        }

        try {
          await T.RPCGen.pgpPgpKeyGenDefaultRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.pgpUi.keyGenerated': ({key}, response) => {
                if (canceled || !mountedRef.current) {
                  response.error(inputCancelError)
                  return
                }
                pgpKeyString = key.key
                response.result()
              },
              'keybase.1.pgpUi.shouldPushPrivate': ({prompt}, response) => {
                if (canceled || !mountedRef.current) {
                  response.error(inputCancelError)
                  return
                }
                cancelCurrentRef.current = () => {
                  canceled = true
                  response.error(inputCancelError)
                }
                finishCurrentRef.current = (shouldStoreKeyOnServer: boolean) => {
                  finishCurrentRef.current = undefined
                  response.result(shouldStoreKeyOnServer)
                }
                setStepSafe({kind: 'finished', pgpKeyString, promptShouldStoreKeyOnServer: prompt})
              },
            },
            incomingCallMap: {'keybase.1.pgpUi.finished': () => {}},
            params: {createUids: {ids, useDefault: false}},
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code !== T.RPCGen.StatusCode.scinputcanceled) {
            throw error
          }
        } finally {
          cancelCurrentRef.current = undefined
          finishCurrentRef.current = undefined
        }
      })()
    )
  }

  const content = (() => {
    switch (step.kind) {
      case 'choice':
        return (
          <Kb.Box2 direction="vertical" gap="small">
            <Kb.Text type="Header">Add a PGP key</Kb.Text>
            <Kb.ChoiceList
              options={[
                {
                  description: 'Keybase will generate a new PGP key and add it to your profile.',
                  icon: 'icon-pgp-key-new-48',
                  onClick: onShowGetNew,
                  title: 'Get a new PGP key',
                },
                {
                  description: 'Import an existing PGP key to your Keybase profile.',
                  icon: 'icon-pgp-key-import-48',
                  onClick: onShowImport,
                  title: 'I have one already',
                },
              ]}
            />
          </Kb.Box2>
        )
      case 'info':
        return (
          <>
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" flex={1}>
              <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" style={styles.centered} />
              <Kb.Text type="BodySemibold" style={styles.centered}>
                Fill in your public info.
              </Kb.Text>
              <Kb.Input3
                autoFocus={true}
                placeholder="Your full name"
                value={data.pgpFullName}
                onChangeText={pgpFullName => onUpdate({pgpFullName})}
              />
              <Kb.Input3
                placeholder="Email 1"
                onChangeText={pgpEmail1 => onUpdate({pgpEmail1})}
                onEnterKeyDown={onGenerate}
                value={data.pgpEmail1}
                error={data.pgpErrorEmail1}
              />
              <Kb.Input3
                placeholder="Email 2 (optional)"
                onChangeText={pgpEmail2 => onUpdate({pgpEmail2})}
                onEnterKeyDown={onGenerate}
                value={data.pgpEmail2}
                error={data.pgpErrorEmail2}
              />
              <Kb.Input3
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
            <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" />
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
              const finish = finishCurrentRef.current
              finishCurrentRef.current = undefined
              finish?.(shouldStoreKeyOnServer)
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
  const [shouldStoreKeyOnServer, setShouldStoreKeyOnServer] = React.useState(false)

  return (
    <Kb.Box2 direction="vertical" alignItems="center" gap="tiny">
      <Kb.PlatformIcon platform="pgp" overlay="icon-proof-success" />
      <Kb.Text type="Header">Here is your unique public key!</Kb.Text>
      <Kb.Text type="Body">
        Your private key has been written to Keybase’s local keychain. You can learn to use it with `keybase
        pgp help` from your terminal. If you have GPG installed, it has also been written to GPG’s keychain.
      </Kb.Text>
      <textarea style={Kb.Styles.castStyleDesktop(styles.pgpKeyString)} readOnly={true} value={props.pgpKeyString} />
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
        onClick={() => props.onDone(shouldStoreKeyOnServer)}
        label={shouldStoreKeyOnServer ? 'Done, post to Keybase' : 'Done'}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      centered: {alignSelf: 'center'},
      math: {flexGrow: 1},
      pgpKeyString: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.fontTerminal,
          backgroundColor: Kb.Styles.globalColors.greyLight,
          border: `solid 1px ${Kb.Styles.globalColors.black_10}`,
          borderRadius: 3,
          color: Kb.Styles.globalColors.black,
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
