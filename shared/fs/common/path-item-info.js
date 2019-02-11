// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

export type PathItemInfoProps = {
  lastModifiedTimestamp?: number,
  lastWriter?: string,
  mode: 'row' | 'default',
}

const Username = ({mode, lastWriter}) =>
  mode === 'row' && Styles.isMobile ? (
    <Kb.Text type="BodySmall">{lastWriter}</Kb.Text>
  ) : (
    <Kb.ConnectedUsernames
      type="BodySmallSecondaryLink"
      usernames={[lastWriter]}
      inline={true}
      onUsernameClicked="profile"
      underline={true}
    />
  )

const PathItemInfo = (props: PathItemInfoProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={props.mode === 'default'}>
    <Kb.Text
      type="BodySmall"
      style={props.mode === 'default' ? styles.textDefault : styles.textRow}
      lineClamp={props.mode === 'row' && Styles.isMobile ? 1 : undefined}
    >
      {!!props.lastModifiedTimestamp &&
        (props.mode === 'default' ? 'Last modified ' : '') +
          formatTimeForFS(props.lastModifiedTimestamp, props.mode === 'default')}
      {!!props.lastWriter && (
        <>
          &nbsp;by&nbsp;
          <Username {...props} />
        </>
      )}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  textDefault: {
    textAlign: 'center',
  },
  textRow: Styles.platformStyles({
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export default PathItemInfo
