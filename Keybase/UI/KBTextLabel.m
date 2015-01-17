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
@property NSTextView *textView;
@end

@implementation KBTextLabel

- (void)viewInit {
  [super viewInit];
  _textView = [[NSTextView alloc] init];
  [self addSubview:_textView];

  _textView.backgroundColor = NSColor.clearColor;
  _textView.editable = NO;
  _textView.selectable = NO;
  _textView.textContainerInset = NSMakeSize(0, 0);
  _textView.textContainer.lineFragmentPadding = 0;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGSize textSize = [KBTextLabel sizeThatFits:size textView:yself.textView];
    [layout setFrame:CGRectMake(0, size.height/2.0 - textSize.height/2.0, size.width, textSize.height) view:yself.textView];
    return size;
  }];
}

- (NSView *)hitTest:(NSPoint)point {
  // TODO call super if selectable?
  return nil;
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment {
  if (!text) text = @"";
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];
  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:font};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  [self setAttributedText:str];
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  _attributedText = attributedText;
  NSAssert(_textView.textStorage, @"No text storage");
  [_textView.textStorage setAttributedString:attributedText];
}

+ (CGSize)sizeThatFits:(CGSize)size textView:(NSTextView *)textView {
  NSTextStorage *textStorage = [[NSTextStorage alloc] initWithAttributedString:textView.attributedString];
  NSTextContainer *textContainer = [[NSTextContainer alloc] initWithContainerSize:NSMakeSize(size.width, FLT_MAX)];
  NSLayoutManager *layoutManager = [[NSLayoutManager alloc] init];
  [layoutManager addTextContainer:textContainer];
  [textStorage addLayoutManager:layoutManager];

  // Force layout
  (void)[layoutManager glyphRangeForTextContainer:textContainer];

  NSRect rect = [layoutManager usedRectForTextContainer:textContainer];
  return CGRectIntegral(rect).size;
}

- (CGSize)sizeThatFits:(CGSize)size {
  return [KBTextLabel sizeThatFits:size textView:_textView];
}

@end
