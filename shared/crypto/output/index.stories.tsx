import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/crypto'
import Output, {OutputBar, SignedSender} from '.'

const onCopyOutput = Sb.action('onCopyOutput')
const onShowInFinder = Sb.action('onShowInFinder')

const encryptOutput = `
BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kjJH07SgogfvQyO W2ceS63l6ZyZLJY QjIHHO1KfgE75hS bnK25qOLLNqWLzt blZcAq80pAiuDz6 RDtndCy8BesZOYg rilXMgRYy1UX15N va5xb0KR5VPRdQB huw6mTEi7X9u2fk zUh7UTKAbos3pNk ewb6y3ZkroVJNch ESlIx1BjI6UpODF vlxCofBeOIU2p6O W3hIPIv8WIrWknZ QOJyV4jViN76Xep atcNK2KvjWagqpz VekV3xU3PaN81Xm U2yidibQ8KAhLxV mx3KsLsXgowF5l6 t1hc1NFVnraZr00 pkWNxLu2CMFfp61 EvhLA06aThBb7q0 3IuIiqFHoDmFBgD txjutGxDXus8LnD QYOTzrvgwX6JZUd ijW1fkOMEENkxD1 WTNEcaAA1KJYJl1 0FCdHwHNtQQAsWG DVOehOioaBE3l2T BfBxxUAvmM81MAD CHEYWRTwmyCnh8V hFqBxUruRyoYFKW G2NkBE7M1vA2beM pjixZcKfN03Cmmw tIHJFRVMz3OJax8 oYw67nW4WR9JC2S PHFDJdhRDABYxmW JHlZjaeEt6LqKtE 7L3xcQ8w6zxkKVl 5q06yU9gDmq5pSv IpCQbob4gVVfCLX ITTtiMA1aaQEL6N KzylNpOsMo7YLBc BbRJk7jb9PY6Mof vTH9HW0jlCOJOqL nMpsxNRbwzO1w9W w7nISYQyI2U5DoA ol9DKthHoZQAEtf UdH4ANGiJGuCFaN 0WC4XhXFYcbyuvX kDP53b5yUHjzxh7 JCbqTobYEPD4wvD s5Ns6SLW7osB1eY CzTbdKuSDuD4eCa 3ojb6yiAKHrCjaZ UFFgKW5KUBv93gm hZgQ2b3CO1Qw0AZ UGOBhA966uOOGCE mqg2y98zq2ypJkl MX4xQtN0XL7Ih1S NPEmBrkbVgbUkkZ 5bxFTXsVKOBSVj3 iCOFpn0jDCCQ77d R1LDfC9vhtiLlOW mczNX7zndL8n6iG X5z1TFnvem6cCWM qQpPoA3MkrAqKSk 9lmRLbqiGwiaPSj zSig9Ap9k7j5Jll USo0Wrsgedwp8c4 qRq98LbVYYKcSKJ f6rdWWSdftKACnm 4heX584El5W5MKf VOJByjl0LuucvrE SDb8E46qFNT66Wp bwVvEfUUKadS74b fKwJClKAmvcIjXl EZ3n52sZzUaFpCd GN3NTfo2XZlDxIr 9gentusb8Xv1uEG Alr6SHVW30zVKA0 JPPgwzg9oPWkssk Iwr2xydGgLDTDrK Skcda2juhWaonwR JkjUBax7sczIGvI S7iNu8mJCjHdDxI ZJ0Nxg8bTOhCpA4 XipvdWbDfsgpfam H21OAOsChvq5gkC 8A2o5LKtdvlyXtw havvDAH00u026QD QuLMWG1ENVVPG6N uLJGDgD5pyiudbA CYxsSIH0LVhmVp2 Dn9ovDVV98ZKUDd nHofeTQP5VgKEqI 8C0d3aBqZQGMySz vpfMvt6d8nTo0uF YOONNMoroxbd0Fr TVWfDejwrYheHon 10fc9xyKAdSj96D QJ4m0rJqsmhgFyT AYwU0zk2Sf7d29c qHSQX57R4KW2Ndj F9rOVbJ2gtLK0zm cMVeIPWl6PImOgL A2bThPxoa5GyIhy L90dzPBXx61pZpv 0NtEcq0mGxXNGCu oAGKUiAjsc7LYQm JolrLw3I3lQopFr RnOCPUojJnfnG6U R2j3pRbGQtMmspb ho9Xf7EnVRpIXmp SUFatddtC7Ygpbi ebeklpz0Qd4KIZn fbpNmI72sxoMx53 rMxcPhujBDzNnxi unmqsB3AYeDrrpS iUlZqMJnLR6bxrU O1ok2MgndIlw9qO tgHYuitD97GfN7G O50h0e659ggBmRQ JbVqrogL0x37Dqu rQDzQ3F9rHSu0Rb phxZbtplQSAu3JZ ozbWylwq0SYVjSL ZqPGCfqfHPkBcPj CkjzN6At0jA8LNT SpdYzg1t3Fa0g5i WKNFOFoYUlQ0VrC MHOm4H2ZMVBhZsa 9yAGuwSYeAW9zjy 9Met8sSimv09UlL ArjdIXKmgN7Yw4R IpXPBHqz3aeuH8i PdCBMluTI7dJtse 1FLoat7521l9Fw2 JUA1eP4q8RHfevQ A19pbIdbhRgoPFi 05LRsVg2YL9rWLd TTuKFmATPDhZZRj 5BAal8v2I31Ka9a J6wxJo0RdfHQ3dh SzdbhegSjUAsE6D Ial9S1OA8tfhUPr g0zP2lnZ0NC3q2H WaI9lNgp0TlzGA0 yrDZg40e9U63Wss fJPvfp97EAuleLg Aq3pIBhYrOtakSj vQZp7R7VMVMcT8t jSP3wnrrhTtYkK4 DM9vjayJmpGP9JT 76AELJXUa3FlKQY u5pG9BIttNj6qjD HGxNYSpcM16uyYY OGO8l5khNwoINHG 6YS64O6AqBLZGWu WsbTkB7QX3eoOeD lvweWtFsT1IEv0S sAt0MjOSpBv18Om gAdxcgBbH4My5iF zDj6iOUbDRkIeCZ g0DUkUj4tEeNMvy Z5s7qFuI80OZ5kq WhDBo98IGjy473G sTWfG2aer9C4JD0 WVjrtumTgCiUWb3 diaB9GUNhMzZoVQ gNj983oBWG2qc9Z tcDMKVpzUYc3xy1 qWS9kpd6FVV49jL Ptv3sYmt66DZFLs hlfsEaljHgIHaQT xgxfxCeLCEgx36M hCSMKUuvyLRG75G nglW3SpXoO9o9Zn XSnLSGq94noRNmM YeDEaCp9Vlt4Zoc KE4L9CT1NZOw9KN H56UGWchR3E13x8 UyWYpmUsyDrpLoK 7odgXKIB6ueTHeq 9cpHs3pQUGcHjaY 1U6MufYNzDuCRE0 fIHJpR2qg4AT6lu 98JxPG8P8pKsxB4 g2gonhTn84kAVU8 EHt0xpltB6MI9Cf Fz6TOPG6OmQQpJK 2jKbmIm17lReP19 IYnlqClAC7QE7Jy MJ4rqRvA1D1dh4n v8polYh7xZaryAS lXR3KZwgFXFWkCn ssr7h4reigzLpSj HCXOUDNtBpi9tU0 NsqNiq4H22B8lmx j9azufVmNSHjjkt
jIFnc6jmnBY5qzM dpWtQ4NSaa7LtOZ cZxjrNJHSeV7XfK 4zGY9TVePCJT57d CN1MAVh8GseH70l kPURd2FFzIPl2jz T1QTmXJzAjvoomc e6QZoq8BSCFK9I3 B1GICXJMmNWpwQ2 Qf2X4limcHeGdnb VZd4xSZ4aFI67Yt poHrq5eVEAqURkW crRZUemBQ1TJAXl ofEPlO3zD4qu5Ta N7LqQxsiiTd1vWc kVT08dk5TfDNf2X 1WKnbcNYjyI4gDY W2SWC6h7yvhIiZS rzWqUmFbQY9YLzc ktX63nVEr2iSat2 QhdAjkY7T9KF6Yv 4Cm2hThiWU2zmn0 7J4BndPgjkZkUVk xHhuC5DP5RohwpN F4AFpTcGcYv4xSH JqRnfY35VCdEgid dSR6TneRLxME7ga U0RkLO9e67JzX9R ubjNbB6S3TUhnZu hlOd0hCZEqRtT38 OjDpPB7CG2W4BI5 infDzfoHUYPH3aK BMY4o3fSesJSrFs Ye4EKKLuofchiqK czRTiHriY7oEvvn hqaFcS7ZAatGQF7 nfgyyJ09CeTEzfE hsh3S0WI1QtKsO7 g1FwJ3wFs13Xm4N LAzYjkVUsYPy7at hAGFADlMIQXk1bT kG287C68TWhMScn 1Z8lL47syBkuOe9 zYKFstWwNcqxSN5 Oc6P41GfYoivEgW FTrV5WsO746HCsM pWuSP6rZGhij0T9 t6m2Xcu1MAI1lnk 0aEbt4nbFe3hs2Q cykMcuK1A0lY85q mrSZCiLGOE0DYol ze8v69PCgkiOPPL lD1srEEDeekNofs itxJkBcmFRuetRl WXw4zsQmDU8IYzS sTpPr5g59E3HZKq uC3d7q8UV1wVkRY iQb6aqCH3pf6wJE qd1Lv5yXOSebSUU qwpQKXDEZk5ClBq 930FNMSc8Xkyesq 10BlMpNoShQ5Ooq clXPDOf5E2j5R3g uXzOt4HR8aikWNU 2QIob8IMEoT3nGF STYYv6xbsFbAWQX Mc3e6FQwox9AlTJ GLYW4CG4YslRuV8 8FMLrLSTQM8SU7Q 0y6A1HdMYMgvyKL yQjfI4LaerJpCEE ijR7Eq3dGMIg74S VemagNsSFLwNjle lh5G0caJ9uaYb7t zKojmU4OZyVEtYp mKhEDXsmNafps3Z sJxyaORNovtEWTm xXPdkOHm3yKSbxp Ui3j0CjXIPm8uPW TpE1Dy4157ev4io V33Vwpcs0LnElld vnsXPqEaVMuNImb dVHzSh7vGaAermO fUPfSMU7g96oro1 sCY1tmcTeiSyl2N bbVeID9Gi70UuTN Hrc4R1EKweBZl09 6e5Q4EmdFdp2U8D MOlwBq8G26Oxggo I5EkZwcEP972pgR IYr1GfnmJiqF1eq hE5umZq9kJKI13F I5GikDYehMN35hY zAlzqqoRHvVIck5 R5BWiNO5W8XCLCH VXRqcbSsug2dP6e ced14Oh36LdwmNb Na04k2M7YPyg41J uiOqMbZO2lZA9TD 1VVYwCES7mKLbsj gv7AdcTPHb6PTzB oueJSbd040QYbVP nkLHJUyrVGvNBeF ybCFlQhiMFNjFTz PpuxbVEZ5iVv2L3 h0QminEpEYljkM2 1viMa4pB1rgKzTO ki4rXj4ns1O681X Ofy8bNZWUGfSn6t 3TpPeuUK0wob8V6 4n5SDRbnynlSzFm bsBaHM329xXkGMf tCYw2d7bnLxRFj3 kj0E7jRBGkKF2ZQ lOMtGPueOv7Z7tQ j7esesHsMakzjee 5GhvgdliH4I8fgq D9bXa1JOXt5bDoB vNCqa0nVOo6TQ6F 913lANGQqi51krG lXlq5qlrfPEiP6I i7D1MMztEJF12ar gAINwmiZUuu6KCF C4rQc6ViEdkTCxu EYexo638rVEa4Fh EJucE8Z32gzc1HL 1gSGyMDVolRs4Ns nYVAZbfzEV27wk0 ujkSJIKgcMjvvhD 8tb673QCG6FaRon uK44zobOCqB9p1B QLW9iZdIEJXKUBA FYnS2I0MghgOFqK HOk39bcI8bj4SzN ICuSXpbMFXxvZ9N WmeXfrCPNBUK1Bn 7VqNrHWZc5RWUa5 7nIHNBpwlKBAB4A hmCJ3xdOwGv4D2a QJwKlGalvtfCSr9 GGFFOsVaHluM9VC wFIfxSLspe8Rhfd alm7oAORlDMYoxn oJGh8EZ07tWCE4k QWUvwj36onBhK2P EWtU9D4RLsO1DQf awMIjJfpBmAc352 zzTt2jIA7HhzxJf b2Hk1DzMFmnIa5W PpYt17Jot9AUEKZ aviASPqYu8zW4ee JFmsl6zyW2swoVq IJX9AYSGGIWFn96 OUlNIT3rQXo7JD0 6fYBbO8vXQwFMVV crYzJwaGoohaeyB I9EvHgIGH2LaVqt 3nd6YDkng3OS9Xn gUUHSovf0QG8wzF LKhfQZlTSzyszZ0 sb61v3hpu7m6Vue NbHuDZZuVVpGQ1P XSIl5pZoM7y1puQ S06OqtWsG6AhBdi x4YwUXPJnX9xtEU RjHku338D5mkNDi GC7fiEboy8l3ICO 5mQ7VUqHNdqs3OK Em5hI6DOkgCF0Ac iGvebMEQcz9lN2F YN51htfJO9ysvqA ydXQPa4F2ZOTUyO 9SI5xdKshckMyty g1AVOcaCQWoq9kY LbNBz1grSXePSr0 064HbjrUD0Nl4A1 imyNo7ZiuooUWFe foTtKsAQxA7FVzq apzTc0UbU5A1DQA FqNlkmAOPnyhs9R q5jrEYKI85XoLkL KnXjS1dqn0R6m1y JYvcqENtC4t9doo 0q4LOkErBn957HX rdCryLO6ayZg1tL H7DdReCi71Z0R8j jJORU8OpOpVaXAk FBX2EMImRVkan2M zrOS7S2eO5GqBlb 2Q7knnHzrNfXxOt deVTfGfd7ZaJL8c fOnGzCxU8tAjw7f uhMj3jQxikqSRe0 x7kQPq9xPFCfcXa PwWgs3bCy7SmZtS xfFFfcN30q8injm sNcU0TCWx1LO8pp pXih1gXN1HEdU36 Ab6uG6r6WoRuqzF CfC2es5yWzeKfTZ
PDCrYyusmTKy4E0 B3it7Kp0TNkspvT 6wxQxC0WRITxnV0 ObzJUJZ1JWyOnS5 2G98uEJSXKQRdbD Ya2KoRfd6OtmNJE qVH. END KEYBASE SALTPACK ENCRYPTED MESSAGE.
`
const decryptOutput = `Plaintext stuff`
const signOutput = `
BEGIN KEYBASE SALTPACK SIGNED MESSAGE. kXR7VktZdyH7rvq v5weRa0zkIFigOx DLGV6rkJYEEHtdM 7WlEE9fJbQO5mhN QeBMk9LcbYLPG97 FPlajQEPpehYw2y WeOn26a8LHQQujz Of70f0T3V01ZZdX 6EuTtEce1L1jYtn dRJirXtQGNoi4ne zeQJUehfZHXVLt8 M1QvFi10F6KVlu1 QTvkbaBP1VfrG1u HhNYto. END KEYBASE SALTPACK SIGNED MESSAGE.
`
const verifyOutput = 'Letting you know if was me'

const load = () => {
  Sb.storiesOf('Crypto/Output', module)
    .add('Encrypt', () => (
      <Output
        output={encryptOutput}
        textType="cipher"
        operation={Constants.Operations.Encrypt}
        onShowInFinder={onShowInFinder}
      />
    ))
    .add('Decrypt', () => (
      <Output
        output={decryptOutput}
        textType="plain"
        operation={Constants.Operations.Verify}
        onShowInFinder={onShowInFinder}
      />
    ))
    .add('Decrypt - Large', () => (
      <Output
        output="Under 120 characters is big"
        textType="plain"
        operation={Constants.Operations.Verify}
        onShowInFinder={onShowInFinder}
      />
    ))
    .add('Sign', () => (
      <Output
        output={signOutput}
        textType="cipher"
        operation={Constants.Operations.Sign}
        onShowInFinder={onShowInFinder}
      />
    ))
    .add('Verify', () => (
      <Output
        output={verifyOutput}
        textType="plain"
        operation={Constants.Operations.Verify}
        onShowInFinder={onShowInFinder}
      />
    ))
    .add('Verify - Large', () => (
      <Output
        output="Under 120 characters is big"
        textType="plain"
        operation={Constants.Operations.Verify}
        onShowInFinder={onShowInFinder}
      />
    ))

  Sb.storiesOf('Crypto/Output/Bar', module).add('Download - Copy', () => (
    <OutputBar
      output="secret stuff"
      outputStatus="success"
      onCopyOutput={onCopyOutput}
      onShowInFinder={onShowInFinder}
    />
  ))

  Sb.storiesOf('Crypto/Output/Signed Sender', module)
    .add('Signed - You - Encrypt', () => (
      <SignedSender
        outputStatus="success"
        signed={true}
        signedBy="cecileb"
        operation={Constants.Operations.Sign}
      />
    ))
    .add('Signed - You - Sign', () => (
      <SignedSender
        outputStatus="success"
        signed={true}
        signedBy="cecileb"
        operation={Constants.Operations.Sign}
      />
    ))
    .add('Signed - Someone Else - Decrypt', () => (
      <SignedSender
        outputStatus="success"
        signed={true}
        signedBy="cecileb"
        operation={Constants.Operations.Decrypt}
      />
    ))
    .add('Signed - Someone Else - Verify', () => (
      <SignedSender
        outputStatus="success"
        signed={true}
        signedBy="cecileb"
        operation={Constants.Operations.Verify}
      />
    ))
    .add('Unsigned - You', () => (
      <SignedSender
        outputStatus="success"
        signed={false}
        signedBy=""
        operation={Constants.Operations.Encrypt}
      />
    ))
    .add('Unsigned - Someone Else', () => (
      <SignedSender
        outputStatus="success"
        signed={false}
        signedBy=""
        operation={Constants.Operations.Decrypt}
      />
    ))
}

export default load
