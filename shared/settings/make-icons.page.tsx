// dev only helper
import * as Kb from '@/common-adapters'
// import * as C from '@/constants'
// import * as React from 'react'
// import KB2 from '@/util/electron.desktop'

// const {DEVwriteMenuIcons} = KB2.functions
// setTimeout(() => {
//   C.useRouterState.getState().dispatch.navigateAppend('makeIcons')
// }, 1000)
//
// const Icon = (p: {badge: number}) => {
//   const {badge} = p
//   const special = badge > 9
//   return (
//     <Kb.Box2
//       direction="vertical"
//       style={{flexShrink: 0, height: 22, overflow: 'hidden', position: 'relative', width: 22}}
//     >
//       <Kb.Icon
//         fontSize={18}
//         type="iconfont-keybase"
//         color="black"
//         style={{alignSelf: 'center', display: 'flex', marginLeft: 0, marginTop: 6}}
//       />
//       <div
//         style={{
//           WebkitFontSmoothing: 'antialiased',
//           color: 'white',
//           flexShrink: 0,
//           fontFamily: 'Keybase',
//           fontSize: 10,
//           fontWeight: 800,
//           height: 12,
//           lineHeight: '10px',
//           position: 'absolute',
//           right: 0,
//           textAlign: 'center',
//           textRendering: 'optimizeLegibility',
//           top: 0,
//           width: 14,
//         }}
//       >
//         <svg width="100%" height="100%">
//           <rect width="14" height="12" rx="6" fill="black" mask={`url(#knockout-text-${badge})`} />
//           <mask id={`knockout-text-${badge}`}>
//             <rect width="100%" height="100%" fill="#fff" x="0" y="0"></rect>
//             <text
//               x="50%"
//               y="80%"
//               fill="#000"
//               textAnchor="middle"
//               stroke={special ? '#000' : undefined}
//               strokeWidth={special ? 1 : 0}
//             >
//               {special ? '+' : String(badge)}
//             </text>
//           </mask>
//         </svg>
//       </div>
//     </Kb.Box2>
//   )
// }
const Icon = (_p: {badge: number}) => null
const DEVwriteMenuIcons = (() => {}) as undefined | (() => void)

const Screen = __DEV__
  ? () => {
      const onSave = () => {
        const oldbg = document.body.style.backgroundColor
        document.body.style.backgroundColor = 'transparent'

        const dte = document.getElementById('divToExport')
        if (!dte) return
        const copy = dte.cloneNode(true) as HTMLDivElement
        copy.id = 'iconCopy'
        document.body.appendChild(copy)

        const root = document.getElementById('root')
        if (!root) return
        root.remove()
        setTimeout(() => {
          DEVwriteMenuIcons?.()
          setTimeout(() => {
            document.body.appendChild(root)
            document.body.style.backgroundColor = oldbg
            copy.remove()
          }, 500)
        }, 100)
      }

      const icons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(badge => <Icon key={badge} badge={badge} />)

      return (
        <Kb.Box2 direction="vertical" style={{backgroundColor: 'purple'}} fullWidth={true} fullHeight={true}>
          <Kb.Button mode="Primary" onClick={onSave} label="Save" />
          <div
            id="divToExport"
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              flexDirection: 'row',
              left: 0,
              position: 'absolute',
              top: 0,
              width: 22,
            }}
          >
            {icons}
          </div>
          <Kb.Box2
            direction="horizontal"
            style={{
              backgroundColor: 'pink',
              marginTop: 100,
              position: 'relative',
              transform: 'scale(5)' as any,
            }}
          >
            {icons}
          </Kb.Box2>
        </Kb.Box2>
      )
    }
  : () => null

const Page = {getScreen: () => Screen}
export default Page
