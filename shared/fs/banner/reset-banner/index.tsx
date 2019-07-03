import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {isMobile} from '../../../constants/platform'

/*
 * This banner is used as part of a List2 in fs/folder/rows/rows.js, so it's
 * important to keep height stable, thus all the height/minHeight/maxHeight in
 * styles.  Please make sure the height is still calculated in getHeight when
 * layout changes.
 *
 */
const addedHeightPerResetUser = isMobile
  ? 2 * Styles.globalMargins.large + Styles.globalMargins.tiny + Styles.globalMargins.small
  : Styles.globalMargins.large + Styles.globalMargins.tiny
const baseHeight = isMobile ? 440 : 378 // Change this when layout changes
export const getHeight = (numResetUsers: number) => baseHeight + numResetUsers * addedHeightPerResetUser

type Props = {
  resetParticipants: Array<string>
  onReAddToTeam: (username: string) => () => void
  onViewProfile: (username: string) => () => void
  onOpenWithoutResetUsers: () => void
}

const Banner = ({resetParticipants, onReAddToTeam, onViewProfile, onOpenWithoutResetUsers}: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    centerChildren={true}
    style={Styles.collapseStyles([styles.banner, fixedHeight(getHeight(resetParticipants.length))])}
  >
    <Kb.Icon
      type={isMobile ? 'icon-skull-64' : 'icon-skull-48'}
      style={{height: Styles.globalMargins.xlarge, margin: Styles.globalMargins.medium}}
    />
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.textIntro}>
      <Kb.Text type="BodySemibold" negative={true}>
        <Kb.ConnectedUsernames
          type="BodySemiboldLink"
          showAnd={true}
          inline={true}
          inlineGrammar={true}
          commaColor={Styles.globalColors.white}
          onUsernameClicked="profile"
          underline={true}
          usernames={resetParticipants}
          backgroundMode="Terminal"
        />
        &nbsp;
        {// This needs to be in the same node as the sister
        // ConnectedUsernames node, because otherwise it gets re-flowed
        // awkwardly.
        'lost all of their devices and ' +
          (resetParticipants.length === 1 ? 'this account has' : 'these accounts have') +
          ' new keys.'}
      </Kb.Text>
      <Kb.Text type="BodySemibold" negative={true}>
        If you want to let them into this folder and the matching chat, you should either:
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.listTextContainer}>
      <Kb.Text type="BodySemibold" negative={true} style={styles.listTextContent}>
        1. Be satisfied with their new proofs, or
      </Kb.Text>
      <Kb.Text type="BodySemibold" negative={true} style={styles.listTextContent}>
        2. Know them outside Keybase and have gotten a thumbs up from them.
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.textDontLetThemIn}>
      <Kb.Text type="BodySemibold" negative={true}>
        Don't let them in until one of those is true.
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" gap="small">
      {resetParticipants.map(p => (
        <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontal'} key={p} gap="tiny">
          <Kb.Button
            mode="Secondary"
            backgroundColor="red"
            label={'View ' + p + "'s profile"}
            onClick={onViewProfile(p)}
            style={styles.button}
          />
          <Kb.Button
            type="Danger"
            backgroundColor="red"
            label={'Let ' + p + ' back in'}
            onClick={onReAddToTeam(p)}
            style={styles.button}
          />
        </Kb.Box2>
      ))}
    </Kb.Box2>
    <Kb.Text type="BodySemibold" negative={true} style={styles.textOrUntil}>
      Or until you're sure,{' '}
      <Kb.Text type="BodySemiboldLink" negative={true} onClick={onOpenWithoutResetUsers}>
        open a folder without {resetParticipants.length > 1 ? 'any of them' : 'them'}.
      </Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const fixedHeight = height => ({
  height,
  maxHeight: height,
  minHeight: height,
})

const styles = Styles.styleSheetCreate({
  banner: {
    backgroundColor: Styles.globalColors.red,
    padding: Styles.globalMargins.medium,
  },
  button: Styles.platformStyles({
    isElectron: {
      width: Styles.globalMargins.xlarge * 4,
    },
    isMobile: {
      width: Styles.globalMargins.xlarge * 5,
    },
  }),
  listTextContainer: {
    ...fixedHeight(isMobile ? Styles.globalMargins.large * 3 : Styles.globalMargins.large * 2),
    justifyContent: 'center',
    maxWidth: isMobile ? 280 : 400,
  },
  listTextContent: {
    marginTop: Styles.globalMargins.tiny,
  },
  textDontLetThemIn: {
    ...fixedHeight(Styles.globalMargins.mediumLarge),
    marginBottom: Styles.globalMargins.tiny,
  },
  textIntro: fixedHeight(Styles.globalMargins.xlarge + Styles.globalMargins.small),
  textOrUntil: {
    marginTop: Styles.globalMargins.small,
  },
})

export default Banner
