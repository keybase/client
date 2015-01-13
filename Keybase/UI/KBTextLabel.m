//
//  KBTextLabel.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTextLabel.h"
#import "KBLookAndFeel.h"

@interface KBTextLabel ()
@end

@implementation KBTextLabel

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    self.editable = NO;
    self.selectable = NO;
    self.textContainerInset = NSMakeSize(0, 0);
    self.textContainer.lineFragmentPadding = 0;
    self.textColor = [KBLookAndFeel textColor];
    self.font = [KBLookAndFeel textFont];
  }
  return self;
}

- (void)setText:(NSString *)text {
  if (!text) text = @"";
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];
  NSDictionary *attributes = @{NSForegroundColorAttributeName:self.textColor, NSFontAttributeName:self.font};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];
  [self setAttributedText:str];
}

- (void)setTextAlignment:(NSTextAlignment)textAlignment {
  _textAlignment = textAlignment;
  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = textAlignment;

  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithAttributedString:self.attributedString];
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  [self.textStorage setAttributedString:str];
}

- (void)setPlaceholder:(NSString *)placeholder {
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:placeholder];
  NSDictionary *attributes = @{NSForegroundColorAttributeName:[KBLookAndFeel disabledTextColor], NSFontAttributeName:self.font};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];
  [self setAttributedText:str];
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  _attributedText = attributedText;
  NSAssert(self.textStorage, @"No text storage");
  [self.textStorage setAttributedString:attributedText];
}

- (CGSize)sizeThatFits:(CGSize)size {
  NSTextStorage *textStorage = [[NSTextStorage alloc] initWithAttributedString:self.attributedString];
  NSTextContainer *textContainer = [[NSTextContainer alloc] initWithContainerSize:NSMakeSize(size.width, FLT_MAX)];
  NSLayoutManager *layoutManager = [[NSLayoutManager alloc] init];
  [layoutManager addTextContainer:textContainer];
  [textStorage addLayoutManager:layoutManager];

  // Force layout
  (void)[layoutManager glyphRangeForTextContainer:textContainer];

  NSRect rect = [layoutManager usedRectForTextContainer:textContainer];
  return CGRectIntegral(rect).size;
}

@end
