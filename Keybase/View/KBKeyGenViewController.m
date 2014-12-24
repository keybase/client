//
//  KBKeyGenViewController.m
//  Keybase
//
//  Created by Gabriel on 12/23/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBKeyGenViewController.h"

@interface KBKeyGenViewController ()
@property IBOutlet NSButton *selectButton;
@end

@implementation KBKeyGenViewController

- (void)awakeFromNib {
  NSColor *color = [NSColor blueColor];
  NSMutableAttributedString *title = [[NSMutableAttributedString alloc] initWithAttributedString:self.selectButton.attributedTitle];
  NSRange titleRange = NSMakeRange(0, title.length);
  [title addAttribute:NSForegroundColorAttributeName value:color range:titleRange];
  [title addAttribute:NSUnderlineStyleAttributeName value:@(YES) range:titleRange];
  [self.selectButton setAttributedTitle:title];
}

@end
