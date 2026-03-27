import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import Modal from '@/profile/modal'
import {validatePgpInfo} from '../validation'

const Info = () => {
  const generatePgp = useProfileState(s => s.dispatch.generatePgp)
  const [pgpFullName, setPgpFullName] = React.useState('')
  const [pgpEmail1, setPgpEmail1] = React.useState('')
  const [pgpEmail2, setPgpEmail2] = React.useState('')
  const [pgpEmail3, setPgpEmail3] = React.useState('')
  const data = {
    pgpEmail1,
    pgpEmail2,
    pgpEmail3,
    pgpFullName,
    ...validatePgpInfo({pgpEmail1, pgpEmail2, pgpEmail3, pgpFullName}),
  }

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => navigateUp()
  const onNext = () =>
    generatePgp({
      pgpEmail1: data.pgpEmail1,
      pgpEmail2: data.pgpEmail2,
      pgpEmail3: data.pgpEmail3,
      pgpFullName: data.pgpFullName,
    })
  const nextDisabled = !data.pgpEmail1 || !data.pgpFullName || !!data.pgpErrorText
  return (
    <Modal onCancel={onCancel} skipButton={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" flex={1}>
        <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" style={styles.centered} />
        <Kb.Text type="BodySemibold" style={styles.centered}>
          Fill in your public info.
        </Kb.Text>
        <Kb.Input3
          autoFocus={true}
          placeholder="Your full name"
          value={data.pgpFullName}
          onChangeText={setPgpFullName}
        />
        <Kb.Input3
          placeholder="Email 1"
          onChangeText={setPgpEmail1}
          onEnterKeyDown={onNext}
          value={data.pgpEmail1}
          error={data.pgpErrorEmail1}
        />
        <Kb.Input3
          placeholder="Email 2 (optional)"
          onChangeText={setPgpEmail2}
          onEnterKeyDown={onNext}
          value={data.pgpEmail2}
          error={data.pgpErrorEmail2}
        />
        <Kb.Input3
          placeholder="Email 3 (optional)"
          onChangeText={setPgpEmail3}
          onEnterKeyDown={onNext}
          value={data.pgpEmail3}
          error={data.pgpErrorEmail3}
        />
        <Kb.Text type={data.pgpErrorText ? 'BodySmallError' : 'BodySmall'}>
          {data.pgpErrorText || 'Include any addresses you plan to use for PGP encrypted email.'}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 fullWidth={true} direction="horizontal" gap="small">
        <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />
        <Kb.Button label="Let the math begin" disabled={nextDisabled} onClick={onNext} style={styles.math} />
      </Kb.Box2>
    </Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      centered: {alignSelf: 'center'},
      math: {flexGrow: 1},
    }) as const
)
export default Info
