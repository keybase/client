import * as React from 'react'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import Text from '../../common-adapters/text'
import {useGetIDInfo} from './hooks'
import {useInterval} from '../../common-adapters/use-timers'
/** @jsx jsx */
import {jsx, css} from '@emotion/core'

const Kb = {
  Text,
}

type Props = {
  username: string
  size: number
}

const HalfCircle = ({percentDone, size, style}) => {
  const color = 'green'
  const backgroundColor = 'white'

  const oneColor = color
  const twoColor = backgroundColor
  const threeColor = backgroundColor

  const oneTransform = ''
  const twoTransform = `rotate(${percentDone}turn)`
  const threeTransform = 'rotate(0.5turn)'

  const width = 6
  const styleSize = size + width * 2

  const common = {
    borderTopLeftRadius: styleSize / 2,
    borderTopRightRadius: styleSize / 2,
    height: styleSize / 2,
    marginLeft: -width,
    marginTop: -width,
    position: 'absolute',
    transformOrigin: 'bottom center',
    width: styleSize,
    //zIndex: 1000,
  } as const

  // overlapping borderradius things fringes on the edges
  const coverStyle = {
    ...common,
    backgroundColor: twoColor,
  }
  const extra = 2
  coverStyle.width += extra * 2
  coverStyle.marginLeft -= extra
  coverStyle.marginTop -= extra
  coverStyle.height += extra
  return (
    <div style={style}>
      <div key="one" style={{...common, backgroundColor: oneColor, transform: oneTransform}} />
      <div
        key="two"
        style={coverStyle}
        css={css`
          transition-duration: 1s;
          transition-property: transform;
          transform: ${twoTransform};
        `}
      />
      <div key="three" style={{...common, backgroundColor: threeColor, transform: threeTransform}} />
    </div>
  )
}

const Circle = (p: Props) => {
  const {username, size} = p
  //const {running, load, percentDone, color} = useGetIDInfo(username)
  // TEMP
  const [percentDone, setPercentDone] = React.useState(0)

  useInterval(
    () => {
      setPercentDone(p => {
        let next = p + 0.1
        if (next >= 1) {
          next = 0
        }
        return next
      })
    },
    //null
    username ? 1000 : null
  )

  if (!username) {
    return null
  }

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
  return (
    <div style={styles.container}>
      <HalfCircle key="0-50" percentDone={Math.min(0.5, percentDone)} size={size} />
      <HalfCircle
        key="50-100"
        percentDone={Math.max(0, percentDone - 0.5)}
        size={size}
        style={styles.lowerStyle}
      />
      <Kb.Text type="Body" style={{position: 'absolute'}}>
        {percentDone}
      </Kb.Text>
    </div>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  lowerStyle: Styles.platformStyles({
    isElectron: {
      height: '100%',
      transform: 'rotate(180deg)',
    },
  }),
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
