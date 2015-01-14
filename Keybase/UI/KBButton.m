//
//  KBButton.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBButton.h"

#import "KBLookAndFeel.h"

@implementation KBButton

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.bezelStyle = NSRoundedBezelStyle;
    self.font = [KBLookAndFeel buttonFont];
  }
  return self;
}

+ (KBButton *)buttonAsLinkWithText:(NSString *)text {
  KBButton *button = [[KBButton alloc] init];
  button.text = text;
  [button setLinkStyle];
  return button;
}

+ (KBButton *)buttonWithText:(NSString *)text {
  KBButton *button = [[KBButton alloc] init];
  button.text = text;
  return button;
}

- (void)setText:(NSString *)text {
  self.title = text ? text : @"";
}

- (NSString *)text {
  if ([self.title isEqualToString:@""]) return nil;
  return self.title;
}

- (void)setLinkStyle {
  self.bordered = NO;
  self.font = [KBLookAndFeel textFont];
  NSColor *color = [KBLookAndFeel selectColor];
  NSMutableAttributedString *title = [[NSMutableAttributedString alloc] initWithAttributedString:self.attributedTitle];
  NSRange titleRange = NSMakeRange(0, title.length);
  [title addAttribute:NSForegroundColorAttributeName value:color range:titleRange];
  //[title addAttribute:NSUnderlineStyleAttributeName value:@(YES) range:titleRange];
  [self setAttributedTitle:title];
}

- (void)setTargetBlock:(KBButtonTargetBlock)targetBlock {
  _targetBlock = targetBlock;
  self.target = self;
  self.action = @selector(_performTargetBlock);
}

- (void)_performTargetBlock {
  if (self.targetBlock) self.targetBlock();
}

@end
