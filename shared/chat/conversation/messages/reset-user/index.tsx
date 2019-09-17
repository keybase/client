import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  allowChatWithoutThem: boolean
  username: string
  viewProfile: () => void
  chatWithoutThem: () => void
  letThemIn: () => void
}

const ResetUser = ({username, viewProfile, letThemIn, allowChatWithoutThem, chatWithoutThem}: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.Icon
      type={isMobile ? 'icon-skull-64' : 'icon-skull-48'}
      style={{height: 64, margin: Styles.globalMargins.medium}}
    />
    <Kb.Box style={styles.textContainer}>
      <Kb.Text center={true} type="BodySemibold" negative={true}>
        <Kb.Text type="BodySemiboldLink" negative={true} onClick={viewProfile}>
          {username}{' '}
        </Kb.Text>
        <Kb.Text type="BodySemibold" negative={true}>
          lost all their devices and this account has new keys. If you want to let them into this chat and
          folder's history, you should either:
        </Kb.Text>
      </Kb.Text>
      <Kb.Box style={styles.bullet}>
        <Kb.Text type="BodySemibold" negative={true} style={{marginTop: Styles.globalMargins.tiny}}>
          1. Be satisfied with their new proofs, or
        </Kb.Text>
        <Kb.Text type="BodySemibold" negative={true} style={{marginTop: Styles.globalMargins.tiny}}>
          2. Know them outside Keybase and have gotten a thumbs up from them.
        </Kb.Text>
      </Kb.Box>
      <Kb.Text type="BodySemibold" negative={true} style={{marginTop: Styles.globalMargins.tiny}}>
        Don't let them in until one of those is true.
      </Kb.Text>
      <Kb.Box
        style={{
          marginBottom: Styles.globalMargins.medium,
          marginTop: Styles.globalMargins.medium,
          ...Styles.globalStyles.flexBoxRow,
        }}
      >
        <Kb.Button
          type="Dim"
          backgroundColor="red"
          onClick={viewProfile}
          label="View profile"
          style={{marginRight: 8}}
        />
        <Kb.Button
          type="Dim"
          backgroundColor="red"
          onClick={letThemIn}
          label="Let them in"
          labelStyle={{color: Styles.globalColors.redDark}}
          style={{backgroundColor: Styles.globalColors.white}}
        />
      </Kb.Box>
      {allowChatWithoutThem && (
        <Kb.Text type="BodySemibold" negative={true}>
          Or until you’re sure,{' '}
          <Kb.Text type="BodySemiboldLink" negative={true} onClick={chatWithoutThem}>
            chat without them
          </Kb.Text>
        </Kb.Text>
      )}
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      bullet: {
        ...Styles.globalStyles.flexBoxColumn,
        maxWidth: 250,
      },
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.red,
        padding: Styles.globalMargins.small,
      },
      textContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingLeft: 64,
        paddingRight: 64,
      },
    } as const)
)

export default ResetUser
