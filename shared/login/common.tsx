import * as Kb from '@/common-adapters'
import type * as React from 'react'

// Question screens in reset/ and recover-password/ hug the top on mobile instead of centering
const styles = Kb.Styles.styleSheetCreate(() => ({
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

type QuestionBodyProps = {
  centered?: boolean // vertically center content on desktop
  children: React.ReactNode
  gap?: 'small' | 'medium'
  icon: React.ReactNode
  topGap?: boolean
}

// icon-over-text body shared by the reset / recover-password question screens
export const QuestionBody = (p: QuestionBodyProps) => {
  const {centered = true, children, gap = 'medium', icon, topGap = true} = p
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      gap={gap}
      alignItems="center"
      centerChildren={centered}
      style={topGap ? styles.topGap : undefined}
    >
      {icon}
      {children}
    </Kb.Box2>
  )
}
