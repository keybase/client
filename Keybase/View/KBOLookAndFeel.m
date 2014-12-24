//
//  KBOLookAndFeel.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBOLookAndFeel.h"

@implementation KBOLookAndFeel

+ (void)applyLinkStyle:(NSButton *)button {
  NSColor *color = [NSColor blueColor];
  NSMutableAttributedString *title = [[NSMutableAttributedString alloc] initWithAttributedString:button.attributedTitle];
  NSRange titleRange = NSMakeRange(0, title.length);
  [title addAttribute:NSForegroundColorAttributeName value:color range:titleRange];
  //[title addAttribute:NSUnderlineStyleAttributeName value:@(YES) range:titleRange];
  [button setAttributedTitle:title];
}

@end
