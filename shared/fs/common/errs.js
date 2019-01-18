// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'

type ErrProps = {
  dismiss: () => void,
  error: string,
  msg: string,
  onFeedback?: () => void,
  retry?: () => void,
  time: number,
}

const Err = (props: ErrProps) => (
  <Kb.Banner
    onClose={props.dismiss}
    text={props.msg}
    color="red"
    actions={[
      ...(props.retry ? [{onClick: props.retry, title: 'Retry'}] : []),
      ...(props.onFeedback ? [{onClick: props.onFeedback, title: 'Let us know'}] : []),
    ]}
  />
)

type ErrsProps = {
  errs: Array<ErrProps & {key: string}>,
}

const Errs = (props: ErrsProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical">
    {props.errs.map(({key, ...errProps}, index) => (
      <React.Fragment key={key}>
        <Err {...errProps} />
        {props.errs.length > 1 && index !== props.errs.length && <Kb.Divider />}
      </React.Fragment>
    ))}
  </Kb.Box2>
)

export default Errs
