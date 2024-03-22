// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
// Also protects it with an error boundary
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as Kb from '@/common-adapters'
import RemoteStore from './store.desktop'
import Root from '../renderer/container.desktop'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import ErrorBoundary from '@/common-adapters/error-boundary'
import {initDesktopStyles} from '@/styles/index.desktop'
import KB2 from '@/util/electron.desktop'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'

setServiceDecoration(ServiceDecoration)

const {closeWindow, showInactive} = KB2.functions

disableDragDrop()
module.hot?.accept()

type RemoteComponents = 'unlock-folders' | 'menubar' | 'pinentry' | 'tracker2'

type Props<DeserializeProps, SerializeProps> = {
  child: (p: DeserializeProps) => React.ReactNode
  deserialize: (state?: DeserializeProps, props?: Partial<SerializeProps>) => DeserializeProps
  name: RemoteComponents
  params: string
  showOnProps: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

function RemoteComponentLoader<DeserializeProps, SerializeProps>(p: Props<DeserializeProps, SerializeProps>) {
  const storeRef = React.useRef<undefined | RemoteStore<DeserializeProps, SerializeProps>>()
  if (!storeRef.current) {
    storeRef.current = new RemoteStore<DeserializeProps, SerializeProps>({
      deserialize: p.deserialize,
      gotPropsCallback: () => {
        if (p.showOnProps) {
          showInactive?.()
        }
      },
      onUpdated: v => {
        setValue(v)
      },
      windowComponent: p.name,
      windowParam: p.params,
    })
  }

  const [value, setValue] = React.useState(storeRef.current._value)

  return (
    <div id="RemoteComponentRoot" style={Kb.Styles.collapseStylesDesktop([p.style ?? styles.container])}>
      <ErrorBoundary closeOnClick={closeWindow} fallbackStyle={styles.errorFallback}>
        <Root>{p.child(value)}</Root>
      </ErrorBoundary>
    </div>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          display: 'block' as const,
          height: '100%',
          overflow: 'hidden',
          width: '100%',
        },
      }),
      errorFallback: {backgroundColor: Kb.Styles.globalColors.white},
      loading: {backgroundColor: Kb.Styles.globalColors.greyDark},
    }) as const
)

export default function Loader<DeserializeProps, SerializeProps>(options: {
  child: (p: DeserializeProps) => React.ReactNode
  deserialize: (state?: DeserializeProps, props?: Partial<SerializeProps>) => DeserializeProps
  name: RemoteComponents
  params?: string
  style?: Kb.Styles.StylesCrossPlatform
  showOnProps?: boolean
}) {
  initDesktopStyles()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.createRoot(node).render(
      <RemoteComponentLoader<DeserializeProps, SerializeProps>
        name={options.name}
        params={options.params || ''}
        style={options.style}
        showOnProps={options.showOnProps ?? true}
        deserialize={options.deserialize}
        child={options.child}
      />
    )
  }
}
