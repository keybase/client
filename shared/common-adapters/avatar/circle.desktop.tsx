import * as React from 'react'
//import * as Container from '../../util/container'
import * as Styles from '../../styles'
import Text from '../../common-adapters/text'
import Icon from '../../common-adapters/icon'
import {useGetIDInfo} from './hooks'
import {useInterval, useTimeout} from '../../common-adapters/use-timers'

const Kb = {
  Icon,
  Text,
}

type Props = {
  username: string
  size: number
}

// This renders a progress circle as two half circles with overflow hidden so we can animate
//the values

const HalfCircle = ({percentDone, size, style, color, width}) => {
  const transform = `rotate(${180 + 360 * percentDone}deg)`
  const styleSize = size + width * 2

  const baseStyle = {
    borderTopLeftRadius: styleSize / 2,
    borderTopRightRadius: styleSize / 2,
    height: styleSize / 2,
    position: 'absolute',
    transformOrigin: 'bottom center',
    width: styleSize,
  } as const

  return (
    <div
      style={{
        ...baseStyle,
        marginLeft: -width,
        marginTop: -width,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div className="halfCircle" style={{...baseStyle, backgroundColor: color, transform}} />
    </div>
  )
}
//transform: ${twoTransform};

const Circle = (p: Props) => {
  const {username, size} = p
  //const {running, load, percentDone, color} = useGetIDInfo(username)
  // TEMP
  const [percentDone, setPercentDone] = React.useState(0.0)
  const [color, setColor] = React.useState<string>(Styles.globalColors.green)
  const [iconOpacity, setIconOpacity] = React.useState(0)
  const width = 6
  const innerRadius = 3
  const containerRef = React.useRef<HTMLDivElement>()

  useInterval(
    () => {
      setPercentDone(p => {
        if (p >= 1) {
          return p
        }
        let next = p + 0.1
        if (next >= 1) {
          next = 1
          setColor(Styles.globalColors.green)
          setIconOpacity(1)
        }
        if (next > 0.3 && color !== Styles.globalColors.red) {
          setColor(Styles.globalColors.red)
        }
        return next
      })
    },
    //null
    //username ? 500 : null
    percentDone >= 1 ? undefined : 500
  )

  const isDone = percentDone >= 1

  const mockState = React.useRef<'drawing' | 'waiting'>('drawing')

  const resetTimer = useTimeout(() => {
    setIconOpacity(0)
    setPercentDone(0)
    mockState.current = 'drawing'

    const div = containerRef.current
    if (div) {
      div.classList.remove('stopped')
      div.classList.remove('resetting')
    }
  }, 2000)

  //let stoppedAnimation = false
  //if (isDone && mockState.current === 'drawing') {
  //stoppedAnimation = true
  //mockState.current = 'waiting'
  //resetTimer()
  //}

  //<Kb.Text type="Body" style={{position: 'absolute'}}>
  //{JSON.stringify(
  //{
  ////color,
  ////load,
  //percentDone,
  ////running,
  //},
  //null,
  //4
  //)}
  //</Kb.Text>
  // maybe not needed
  //let stopStyle = {}

  //// stop the animation smoothly
  //if (percentDone >= 1) {
  //stopStyle = {
  //animationPlayState: 'paused',
  //transform: 'rotate(0deg)',
  //}
  //}
  //if (stoppedAnimation && containerRef.current) {
  //containerRef.current.style.
  //}

  React.useEffect(() => {
    const div = containerRef.current
    if (!isDone || !div || mockState.current !== 'drawing') {
      return
    }

    mockState.current = 'waiting'

    const matrix = getComputedStyle(div).transform
    if (matrix) {
      const [, rot] = matrix
        .split('(')[1]
        .split(')')[0]
        .split(',')

      const angle = Math.round(Math.asin(parseFloat(rot)) * (180 / Math.PI))
      console.log('aaa angle', angle)

      div.classList.add('stopped')
      div.style.transform = `rotate(${angle}deg)`
      setTimeout(() => {
        div.classList.add('resetting')
        div.style.transform = `rotate(${0}deg)`
      }, 1)
    }
    resetTimer()
  }, [isDone, containerRef, resetTimer])

  if (!username) {
    return null
  }

  //<Kb.Text type="Body" style={{position: 'absolute'}}>
  //{percentDone}
  //</Kb.Text>
  return (
    <div style={styles.container} ref={containerRef} className="circle">
      <HalfCircle
        key="0-50"
        percentDone={Math.min(0.5, percentDone)}
        width={width}
        size={size}
        style={Styles.collapseStyles([{marginTop: -width}, styles.lowStyle])}
        color={color}
      />
      <HalfCircle
        key="50-100"
        percentDone={Math.max(0, percentDone - 0.5)}
        width={width}
        size={size}
        style={Styles.collapseStyles([{marginBottom: -width}, styles.highStyle])}
        color={color}
      />
      <div
        style={Styles.collapseStyles([
          styles.innerCircle,
          {
            bottom: -innerRadius,
            left: -innerRadius,
            right: -innerRadius,
            top: -innerRadius,
          },
        ])}
      />
      <Kb.Icon type="iconfont-people" color={color} style={{opacity: iconOpacity}} className="circleIcon" />
    </div>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    height: '100%',
    position: 'absolute',
    width: '100%',
    //zIndex: 1,
  },
  highStyle: Styles.platformStyles({
    isElectron: {transform: 'rotate(180deg)'},
  }),
  innerCircle: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.whiteOrWhite,
      borderRadius: '100%',
      position: 'absolute',
    },
  }),
  lowStyle: {},
}))

// rn one
//const Circle ({
//const activeColor = 'green'
//const passiveColor = 'grey'
//const baseColor = 'red'
//const radius = 128
//const width = 128
//const duration = 1
//const initialValueInnerCircle = 0;
//const timePerDegree = duration / 360;
//const color1 = activeColor;
//const color2 = done >= 50 ? activeColor : passiveColor;

//const [done, setDone] = React.useState(0)
//const initialValueHalfCircle = done >= 50 ? 0 : 180;

//const [animatedValue1, setAnimatedValue1] = React.useState(initialValueHalfCircle)
//const [animatedValue2,setAnimatedValue2] = React.useState(initialValueHalfCircle)
//const [animatedValue3,setAnimatedValue3] = React.useState(initialValueInnerCircle)

//useInterval(() => {
//setDone(p => {
//let next = p + 10
//if (next >= 100) {
//next = 0
//}
//return next
//})
//}, 1000)

//const firstAnimation = () => {
//setAnimatedValue1 (180);
//setAnimatedValue2(180 + (done - 50) * 3.6);
//setAnimatedValue3(timePerDegree * ((done - 50) * 3.6),)

////return {
////one: css`
////transition-duration: 1s;
////transition-property: transform;
////transform: ${twoTransform};
////` ,
////two: ,
////three:
////}

////Animated.parallel([
////Animated.timing(animatedValue1, {
////toValue: 180,
////duration: 180 * timePerDegree,
////useNativeDriver: true,
////easing: Easing.linear
////}),
////Animated.timing(animatedValue2, {
////toValue: 180 + (done - 50) * 3.6,
////duration: (180 + (done - 50) * 3.6) * timePerDegree,
////useNativeDriver: true,
////easing: Easing.linear
////}),
////Animated.timing(animatedValue3, {
////toValue: (done - 50) * 3.6,
////delay: 180 * timePerDegree,
////duration: timePerDegree * ((done - 50) * 3.6),
////useNativeDriver: true,
////easing: Easing.linear
////})
////]).start();
//};

//const secondAnimation = () => {
////animatedValue1.setValue(initialValueHalfCircle);
////animatedValue2.setValue(initialValueHalfCircle);
////animatedValue3.setValue(initialValueInnerCircle);
////Animated.timing(animatedValue2, {
////toValue: 180 + done * 3.6,
////duration: done * 3.6 * timePerDegree,
////useNativeDriver: true,
////easing: Easing.linear
////}).start();
//};

//useEffect(() => {
//if (done >= 50) {
//firstAnimation();
//} else {
//secondAnimation();
//}
//}, [done]);

//const renderHalf = (color: string, transforms = [], otherStyles = {}) => (
//<div
//style={[
//styles.half,
//{ backgroundColor: color, borderColor: color },
//{ width: radius, height: radius * 2, borderRadius: radius },
//{
//transform: [
//{ translateX: radius / 2 },
//...transforms,
//{ translateX: -radius / 2 },
//{ scale: 1.004 }
//]
//},
//otherStyles
//]}
//></div>
//);

////const rotate1 = animatedValue1.interpolate({
////inputRange: [0, 1],
////outputRange: ["0deg", "1deg"]
////});
////const rotate2 = animatedValue2.interpolate({
////inputRange: [0, 1],
////outputRange: ["0deg", "1deg"]
////});

////const rotate3 = animatedValue3.interpolate({
////inputRange: [0, 1],
////outputRange: ["0deg", "1deg"]
////});

////const elevation3 = animatedValue3.interpolate({
////inputRange: [0, 1],
////outputRange: [0, -1]
////});
//const rotate1 =`${animatedValue1}deg`
//const rotate2 =`${animatedValue2}deg`
//const rotate3 =`${animatedValue3}deg`
//const elevation3 = animatedValue3 === 0 ? 1 : 0

//return (
//<div style={styles.container}>
//<div
//style={[
//styles.outer,
//{ backgroundColor: passiveColor },
//{ borderRadius: radius, height: radius * 2, width: radius * 2 }
//]}
//>
//{renderHalf(color1, [{ rotate: rotate1 }])}
//{renderHalf(color2, [{ rotate: rotate2 }])}
//{renderHalf(passiveColor, [{ rotate: rotate3 }], {
//sIndex: elevation3
//})}
//<div
//style={[
//{
//backgroundColor: baseColor,
//width: 2 * radius - width,
//height: 2 * radius - width,
//borderRadius: radius,
//elevation: 1000,
//display: "flex",
//justifyContent: "center",
//alignItems: "center"
//}
//]}
//>
//{children}
//</div>
//</div>
//</div>
//);
//};

//const styles = Styles.styleSheetCreate(() => ({
//container: {
//flex: 1,
//margin: 50,
//backgroundColor: "#fff",
//alignItems: "center",
//justifyContent: "center"
//},
//outer: {
//position: "relative",
//justifyContent: "center",
//alignItems: "center"
//},
//half: {
//position: "absolute",
//left: 0,
//top: 0,
//borderTopRightRadius: 0,
//borderBottomRightRadius: 0
//}
//}))

export default Circle
