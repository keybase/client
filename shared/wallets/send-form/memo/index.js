// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {}

const Memo = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        Encrypted note
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.bodyText}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque fermentum, mauris sed laoreet
        aliquam, magna purus volutpat libero, ut fringilla dui tellus id diam. In eleifend pretium orci, ut
        tincidunt nulla venenatis gravida. Duis ligula tellus, aliquet a diam in, elementum sodales velit.
        Quisque sagittis purus malesuada dui sodales luctus. Cras dignissim gravida sem, sed molestie leo
        ullamcorper ut. Donec viverra vitae augue et viverra. Etiam et ex sollicitudin, sodales magna eget,
        imperdiet lacus. Suspendisse semper neque eu nulla euismod placerat. Suspendisse condimentum congue
        odio in finibus. Fusce faucibus aliquam risus at laoreet. Integer dui nibh, tempus varius rutrum sed,
        sodales id lectus. Phasellus eleifend porttitor purus eget viverra. Sed venenatis sapien sed sodales
        posuere. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut efficitur varius diam nec
        malesuada. Interdum et malesuada fames ac ante ipsum primis in faucibus. Maecenas urna justo,
        dignissim in urna a, bibendum lobortis lectus. Suspendisse ex justo, maximus faucibus elementum nec,
        posuere nec elit. Nunc augue tellus, gravida sit amet nulla vel, lacinia eleifend ipsum. Quisque
        mattis, dolor at posuere pellentesque, est nibh tincidunt sem, id suscipit lacus massa sit amet elit.
        Vestibulum non sem nec neque dignissim ullamcorper vel ut ante. Quisque lorem nisl, tincidunt at
        mauris vitae, tristique dictum nisi. Mauris eu elit accumsan lectus dignissim imperdiet vitae at
        purus. Aliquam lobortis elementum nibh, in viverra nisi sollicitudin vitae. Nulla at dignissim ex,
        quis gravida mi. Proin non tortor erat. Aliquam euismod in dui ut tristique. Etiam tempus, risus
        rutrum aliquam pharetra, risus dolor porttitor elit, et finibus ex nibh in metus. Aenean fringilla
        elit vitae scelerisque rhoncus. Donec vitae aliquet lacus, a blandit ante. Vestibulum iaculis libero
        sit amet sem eleifend scelerisque. Phasellus scelerisque dui accumsan accumsan cursus. Maecenas auctor
        orci vitae turpis posuere fermentum.
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        Public memo
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.bodyText}>
        Public note
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  // container: Styles.platformStyles({
  //   isElectron: {
  //     borderBottomStyle: 'solid',
  //     borderBottomWidth: 1,
  //     borderBottomColor: Styles.globalColors.black_05,
  //   },
  // }),
  memoContainer: Styles.platformStyles({
    isElectron: {
      paddingTop: 7.5,
      paddingBottom: 7.5,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,

      borderTopStyle: 'solid',
      borderTopWidth: 1,
      borderTopColor: Styles.globalColors.black_05,
    },
  }),
  headingText: {
    color: Styles.globalColors.blue,
    marginBottom: Styles.globalMargins.xtiny,
  },
  bodyText: {},
})

export default Memo
