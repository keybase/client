import * as React from 'react'
import * as Kb from '../../common-adapters'

export type ErrProps = {
  dismiss: () => void
  key: string
  msg: string
  onFeedback?: () => void
  retry?: () => void
  time: number
}

const Err = (props: ErrProps) => (
  <Kb.Banner onClose={props.dismiss} color="red">
    <Kb.BannerParagraph
      bannerColor="red"
      content={[
        props.msg,
        ...(props.retry ? [' ', {onClick: props.retry, text: 'Retry'}] : []),
        ...(props.onFeedback ? [' ', {onClick: props.onFeedback, text: 'Let us know'}] : []),
      ]}
    />
  </Kb.Banner>
)

type ErrsProps = {
  errs: Array<ErrProps>
}

const Errs = (props: ErrsProps) => (
  <>
    <Kb.Box2 fullWidth={true} direction="vertical">
      {props.errs.map((errProps, index) => (
        <React.Fragment key={errProps.key}>
          <Err {...errProps} />
          {props.errs.length > 1 && index !== props.errs.length && <Kb.Divider />}
        </React.Fragment>
      ))}
    </Kb.Box2>
    {!!props.errs.length && <Kb.Divider />}
  </>
)

export default Errs
