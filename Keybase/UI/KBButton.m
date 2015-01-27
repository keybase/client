//
//  KBButton.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBButton.h"

#import "KBLookAndFeel.h"
#import "KBLabel.h"

@implementation KBButton

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.wantsLayer = YES;
    self.bezelStyle = NSRoundedBezelStyle;
    self.font = [KBLookAndFeel buttonFont];
    //self.layer.backgroundColor = [NSColor colorWithWhite:0.5 alpha:1.0].CGColor;
  }
  return self;
}

+ (instancetype)buttonWithLinkText:(NSString *)text {
  KBButton *button = [[KBButton alloc] init];
  button.bordered = NO;
  [button setText:text font:[KBLookAndFeel textFont] color:[KBLookAndFeel selectColor] alignment:NSCenterTextAlignment];
  return button;
}

+ (instancetype)buttonWithLinkText:(NSString *)text font:(NSFont *)font alignment:(NSTextAlignment)alignment {
  KBButton *button = [[KBButton alloc] init];
  button.bordered = NO;
  [button setText:text font:font color:[KBLookAndFeel selectColor] alignment:alignment];
  return button;
}

+ (instancetype)buttonWithText:(NSString *)text {
  KBButton *button = [[KBButton alloc] init];
  [button setText:text font:[KBLookAndFeel buttonFont] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  return button;
}

+ (instancetype)buttonWithImage:(NSImage *)image {
  KBButton *button = [[KBButton alloc] init];
  button.image = image;
  button.bordered = NO;
  return button;
}

- (CGSize)sizeThatFits:(CGSize)size {
  return [KBLabel sizeThatFits:size attributedString:self.attributedTitle];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment {
  NSParameterAssert(font);
  NSParameterAssert(color);
  if (!text) text = @"";
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];
  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:font};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = NSLineBreakByTruncatingTail;
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  [self setAttributedTitle:str];
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
