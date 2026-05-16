import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useFsErrors, useFsRedbarActions} from './error-state'

const ErrsContainer = () => {
  const errors = useFsErrors()
  const {dismissRedbar} = useFsRedbarActions()
  const props = {
    errs: errors.map((err, i) => ({
      dismiss: () => dismissRedbar(i),
      msg: err,
    })),
  }
  return (
    <>
      <Kb.Box2 fullWidth={true} direction="vertical">
        {props.errs.map((errProps, index) => (
          <React.Fragment key={index}>
            <Err {...errProps} />
            {props.errs.length > 1 && index !== props.errs.length - 1 && <Kb.Divider />}
          </React.Fragment>
        ))}
      </Kb.Box2>
      {!!props.errs.length && <Kb.Divider />}
    </>
  )
}

const Err = (props: {dismiss: () => void; msg: string}) => (
  <Kb.Banner onClose={props.dismiss} color="red">
    <Kb.BannerParagraph bannerColor="red" content={props.msg} />
  </Kb.Banner>
)

export default ErrsContainer
