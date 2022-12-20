import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

export type LastModifiedLineProps = {
  lastModifiedTimestamp?: number
  lastWriter?: string
  mode: 'row' | 'default' | 'menu'
}

const Username = ({mode, lastWriter}: {mode: LastModifiedLineProps['mode']; lastWriter: string}) =>
  mode === 'row' && Styles.isMobile ? (
    <Kb.Text type="BodySmall">{lastWriter}</Kb.Text>
  ) : (
    <Kb.ConnectedUsernames
      type={mode === 'menu' ? 'BodyTinyLink' : 'BodySmallSecondaryLink'}
      usernames={lastWriter}
      inline={true}
      onUsernameClicked="profile"
      underline={true}
    />
  )

const LastModifiedLine = (props: LastModifiedLineProps) => {
  const time =
    !!props.lastModifiedTimestamp &&
    (props.mode === 'row' ? '' : 'Last modified ') +
      formatTimeForFS(props.lastModifiedTimestamp, props.mode !== 'row')
  const by = !!props.lastWriter && (
    <>
      &nbsp;by&nbsp;
      <Username mode={props.mode} lastWriter={props.lastWriter} />
    </>
  )
  switch (props.mode) {
    case 'menu':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
          <Kb.Text fixOverdraw={true} type="BodyTiny" center={true}>
            {time}
          </Kb.Text>
          <Kb.Text fixOverdraw={true} type="BodyTiny" center={true}>
            {by}
          </Kb.Text>
        </Kb.Box2>
      )
    case 'row':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text fixOverdraw={true} type="BodySmall" lineClamp={1}>
            {time}
            {by}
          </Kb.Text>
        </Kb.Box2>
      )
    case 'default':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
          <Kb.Text fixOverdraw={true} type="BodySmall" center={true}>
            {time}
            {by}
          </Kb.Text>
        </Kb.Box2>
      )
  }
}

export default LastModifiedLine
