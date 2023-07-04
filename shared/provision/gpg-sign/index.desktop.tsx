// // TODO remove Container
// import Container from '../../login/forms/container'
// import * as React from 'react'
// import Row from './row.desktop'
// import * as Kb from '../../common-adapters'
// import * as Styles from '../../styles'

// import type {Props} from '.'

// class GPGSign extends React.Component<Props> {
//   render() {
//     return (
//       <Container style={styles.container} onBack={() => this.props.onBack()}>
//         {this.props.importError && (
//           <Kb.Box2 direction="vertical" centerChildren={true}>
//             <Kb.Text type="Header" style={styles.header}>
//               There was an error importing your pgp key:
//               {'\n'}
//             </Kb.Text>
//             <Kb.Text type="BodySmallError">{this.props.importError}</Kb.Text>
//             <Kb.Text type="Body">You can try asking gpg to sign this install instead.</Kb.Text>
//           </Kb.Box2>
//         )}
//         <Kb.Text type="Header" style={styles.header}>
//           Let's sign your installation of keybase with GPG
//         </Kb.Text>
//         <Kb.Text type="Body" style={styles.subHeader}>
//           Allow Keybase to run PGP commands?
//         </Kb.Text>
//         <Kb.Box2 direction="vertical" centerChildren={true} style={{maxWidth: 750}}>
//           {!this.props.importError && (
//             <Row
//               onClick={() => this.props.onSubmit(true)}
//               icon="icon-GPG-export"
//               title="Export your secret key from GPG"
//             >
//               <p>
//                 <Kb.Text type="BodySmall">
//                   This copies your PGP pair into Keybase's local encrypted keyring. Later, you can{' '}
//                 </Kb.Text>
//                 <Kb.Text type="Terminal">keybase pgp sign</Kb.Text>
//                 <Kb.Text type="BodySmall"> and </Kb.Text>
//                 <Kb.Text type="Terminal">keybase pgp decrypt</Kb.Text>
//                 <Kb.Text type="BodySmall"> messages and files.</Kb.Text>
//               </p>
//             </Row>
//           )}
//           <Row
//             onClick={() => this.props.onSubmit(false)}
//             icon="icon-terminal-48"
//             title="One-time shell to GPG"
//           >
//             <p>
//               <Kb.Text type="BodySmall">
//                 Keybase can ask GPG to sign this install. You won't be able to use{' '}
//               </Kb.Text>
//               <Kb.Text type="Terminal">keybase pgp</Kb.Text>
//               <Kb.Text type="BodySmall"> commands on this computer.</Kb.Text>
//             </p>
//           </Row>
//         </Kb.Box2>
//       </Container>
//     )
//   }
// }

// const styles = Styles.styleSheetCreate(
//   () =>
//     ({
//       container: {
//         alignItems: 'center',
//         flex: 1,
//       },
//       header: {
//         marginTop: 36,
//       },
//       subHeader: {
//         marginBottom: 30,
//       },
//     } as const)
// )

// export default GPGSign
export {}
