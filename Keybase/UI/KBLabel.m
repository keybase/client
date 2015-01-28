//
//  KBLabel.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabel.h"

#import <Slash/Slash.h>

@interface KBLabel ()
@property NSTextView *textView;
@end

@implementation KBLabel

- (void)viewInit {
  [super viewInit];
  _textView = [[NSTextView alloc] init];
  _textView.backgroundColor = NSColor.clearColor;
  _textView.editable = NO;
  _textView.selectable = NO;
  _textView.textContainerInset = NSMakeSize(0, 0);
  _textView.textContainer.lineFragmentPadding = 0;
  [self addSubview:_textView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGSize textSize = [KBLabel sizeThatFits:size attributedString:yself.textView.attributedString];
    [layout setFrame:CGRectIntegral(CGRectMake(0, size.height/2.0 - textSize.height/2.0, size.width, textSize.height + 20)) view:yself.textView];
    return size;
  }];
}

- (NSView *)hitTest:(NSPoint)point {
  // TODO call super if selectable?
  return nil;
}

- (BOOL)hasText {
  return (self.attributedText && self.attributedText.length > 0);
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
  //paragraphStyle.lineBreakMode = NSLineBreakByTruncatingTail;
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  [self setAttributedText:str];
}

- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSDictionary *style = @{@"$default": @{NSFontAttributeName: font},
                          @"p": @{NSFontAttributeName: font},
                          @"em": @{NSFontAttributeName: [NSFont fontWithName:@"Helvetica Neue Italic" size:16]},
                          @"strong": @{NSFontAttributeName: [NSFont boldSystemFontOfSize:font.pointSize]},};
  NSMutableAttributedString *str = [[SLSMarkupParser attributedStringWithMarkup:markup style:style error:nil] mutableCopy];
  [str addAttribute:NSForegroundColorAttributeName value:color range:NSMakeRange(0, str.length)];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  [self setAttributedText:str];
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  _attributedText = attributedText;
  if (_attributedText) {
    NSAssert(_textView.textStorage, @"No text storage");
    [_textView.textStorage setAttributedString:attributedText];
  }
  [self setNeedsLayout];
}

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString {
  NSTextStorage *textStorage = [[NSTextStorage alloc] initWithAttributedString:attributedString];
  if (size.height == 0) size.height = CGFLOAT_MAX;
  if (size.width == 0) size.width = CGFLOAT_MAX;
  NSTextContainer *textContainer = [[NSTextContainer alloc] initWithContainerSize:size];
  NSLayoutManager *layoutManager = [[NSLayoutManager alloc] init];
  [layoutManager addTextContainer:textContainer];
  [textStorage addLayoutManager:layoutManager];

  // Force layout
  (void)[layoutManager glyphRangeForTextContainer:textContainer];

  NSRect rect = [layoutManager usedRectForTextContainer:textContainer];
  rect.size.height += 3; // For descenders to not get clipped? TODO: Fixme
  return CGRectIntegral(rect).size;
}

- (CGSize)sizeThatFits:(CGSize)size {
  return [KBLabel sizeThatFits:size attributedString:_textView.attributedString];
}

+ (NSMutableAttributedString *)join:(NSArray *)attributedStrings delimeter:(NSAttributedString *)delimeter {
  NSMutableAttributedString *text = [[NSMutableAttributedString alloc] init];
  for (NSInteger index = 0; index < attributedStrings.count; index++) {
    NSAttributedString *as = attributedStrings[index];
    if (as.length > 0) {
      [text appendAttributedString:as];
      if (delimeter && index < attributedStrings.count - 1) {
        [text appendAttributedString:delimeter];
      }
    }
  }
  return text;
}


@end
