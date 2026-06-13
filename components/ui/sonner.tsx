'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': '#BFCC94',
          '--normal-text': '#ffffff',
          '--normal-border': '#a8bb78',
          '--success-bg': '#BFCC94',
          '--success-text': '#ffffff',
          '--success-border': '#a8bb78',
          '--error-bg': '#BFCC94',
          '--error-text': '#ffffff',
          '--error-border': '#a8bb78',
          '--warning-bg': '#BFCC94',
          '--warning-text': '#ffffff',
          '--warning-border': '#a8bb78',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
