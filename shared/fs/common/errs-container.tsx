import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useFsErrors, useFsRedbarActions} from './error-state'

const ErrsContainer = () => {
  const errors = useFsErrors()
  const {dismissRedbar} = useFsRedbarActions()
  const errs = errors.map((err, i) => ({
    dismiss: () => dismissRedbar(i),
    msg: err,
  }))
  // Render nothing when there are no errors. An empty wrapper sits as the first child of the
  // tab screen and breaks iOS 26 tabBarMinimizeBehavior scroll-view detection.
  if (errs.length === 0) {
    return null
  }
  return (
    <>
      <Kb.Box2 fullWidth={true} direction="vertical">
        {errs.map((errProps, index) => (
          <React.Fragment key={index}>
            <Err {...errProps} />
            {errs.length > 1 && index !== errs.length - 1 && <Kb.Divider />}
          </React.Fragment>
        ))}
      </Kb.Box2>
      {!!errs.length && <Kb.Divider />}
    </>
  )
}

const Err = (props: {dismiss: () => void; msg: string}) => (
  <Kb.Banner onClose={props.dismiss} color="red">
    <Kb.BannerParagraph bannerColor="red" content={props.msg} />
  </Kb.Banner>
)

export default ErrsContainer
