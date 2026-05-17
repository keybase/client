import * as Kb from '@/common-adapters'

type DOMElement = {
  id: string
  style: {backgroundColor: string}
  cloneNode: (deep: boolean) => DOMElement
  remove: () => void
}
type DOMDoc = {
  body: {
    style: {backgroundColor: string}
    appendChild: (el: DOMElement) => void
  }
  getElementById: (id: string) => DOMElement | null
}
const doc = (globalThis as {document?: DOMDoc}).document

const Icon = (_p: {badge: number}) => null
const DEVwriteMenuIcons = (() => {}) as undefined | (() => void)

const Screen = __DEV__
  ? () => {
      if (isMobile) return null

      const onSave = () => {
        if (!doc) return
        const oldbg = doc.body.style.backgroundColor
        doc.body.style.backgroundColor = 'transparent'

        const dte = doc.getElementById('divToExport')
        if (!dte) return
        const copy = dte.cloneNode(true)
        copy.id = 'iconCopy'
        doc.body.appendChild(copy)

        const root = doc.getElementById('root')
        if (!root) return
        root.remove()
        setTimeout(() => {
          DEVwriteMenuIcons?.()
          setTimeout(() => {
            doc.body.appendChild(root)
            doc.body.style.backgroundColor = oldbg
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
            style={Kb.Styles.platformStyles({
              isElectron: {
                backgroundColor: 'pink',
                marginTop: 100,
                position: 'relative',
                transform: 'scale(5)',
              },
            } as const)}
          >
            {icons}
          </Kb.Box2>
        </Kb.Box2>
      )
    }
  : () => null

export default Screen
