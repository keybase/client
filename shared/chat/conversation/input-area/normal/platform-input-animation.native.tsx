import * as Kb from '../../../../common-adapters/mobile.native'

export const AnimatedBox2 = Kb.ReAnimated.createAnimatedComponent(Kb.Box2)
export const AnimatedIcon = Kb.ReAnimated.createAnimatedComponent(Kb.Icon)

export enum AnimationState {
  none,
  expanding,
  contracting,
}

const {call, set, cond, timing, block, Value, not} = Kb.ReAnimated
const {startClock, stopClock, clockRunning, eq} = Kb.ReAnimated

export const runToggle = (
  clock: Kb.ReAnimated.Clock,
  state: Kb.ReAnimated.Value<AnimationState>,
  value: Kb.ReAnimated.Value<number>,
  small: number | undefined,
  big: number,
  cb: () => void
) =>
  block([
    cond(eq(state, AnimationState.expanding), set(value, runTiming(clock, value, new Value(big), cb))),
    cond(
      eq(state, AnimationState.contracting),
      set(value, runTiming(clock, value, small ? new Value(small) : new Value(0), cb))
    ),
  ])

export const runTiming = (
  clock: Kb.ReAnimated.Clock,
  value: Kb.ReAnimated.Value<number>,
  dest: Kb.ReAnimated.Value<number>,
  cb: () => void
) => {
  const state = {
    finished: new Value(0),
    frameTime: new Value(0),
    position: new Value(0),
    time: new Value(0),
  }

  const config = {
    duration: 250,
    easing: Kb.ReAnimatedEasing.inOut(Kb.ReAnimatedEasing.ease),
    toValue: new Value(0),
  }

  return block([
    cond(clockRunning(clock), 0, [
      set(state.finished, 0),
      set(state.frameTime, 0),
      set(state.time, 0),
      set(state.position, value),
      set(config.toValue, dest),
      startClock(clock),
    ]),
    timing(clock, state, config),
    cond(state.finished, stopClock(clock)),
    cond(state.finished, call([], cb)),
    state.position,
  ])
}

export const runRotateToggle = (
  clock: Kb.ReAnimated.Clock,
  animState: Kb.ReAnimated.Value<AnimationState>,
  from: Kb.ReAnimated.Value<number>
) => {
  const state = {
    finished: new Value(0),
    frameTime: new Value(0),
    position: new Value(0),
    time: new Value(0),
  }

  const config = {
    duration: 200,
    easing: Kb.ReAnimatedEasing.inOut(Kb.ReAnimatedEasing.ease),
    toValue: new Value(0),
  }

  const dest = new Kb.ReAnimated.Value<number>(0)

  return block([
    cond(eq(animState, AnimationState.expanding), [set(dest, 180)], [set(dest, 0)]),
    cond(not(clockRunning(clock)), [
      set(state.finished, 0),
      set(state.time, 0),
      set(state.position, from),
      set(state.frameTime, 0),
      startClock(clock),
    ]),
    set(config.toValue, dest),
    timing(clock, state, config),
    cond(state.finished, stopClock(clock)),
    set(from, state.position),
    state.position,
  ])
}
