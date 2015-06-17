//
//  KBLabel.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabel.h"

#import "KBBox.h"
#import "KBAppearance.h"
#import "KBText.h"
#import "NSView+KBView.h"

@interface KBLabel ()
@property NSTextView *textView;
@property KBTextStyle style;
@property KBTextOptions options;
@end

@implementation KBLabel

- (void)viewInit {
  [super viewInit];
  self.identifier = self.className;
  _textView = [[NSTextView alloc] init];
  _textView.backgroundColor = NSColor.clearColor;
  _textView.editable = NO;
  _textView.selectable = NO;
  _textView.textContainerInset = NSZeroSize;
  _textView.textContainer.lineFragmentPadding = 0;
  [self addSubview:_textView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    
    UIEdgeInsets insets = self.allInsets;
    CGSize sizeThatFits = [KBText sizeThatFits:CGSizeMake(size.width - insets.left - insets.right, 0) textView:self.textView];

    CGSize sizeWithInsets = CGSizeMake(sizeThatFits.width + insets.left + insets.right, sizeThatFits.height + insets.top + insets.bottom);

    // TODO vertical and horizontal aligns

    CGRect textFrame = CGRectMake(insets.left, insets.top, size.width - insets.left - insets.right, sizeThatFits.height);
    CGSize borderSize = size;

    if (self.verticalAlignment == KBVerticalAlignmentMiddle) {
      textFrame.origin.y = ceilf(size.height/2.0 - sizeThatFits.height/2.0);
      textFrame.size.height = MAX(sizeThatFits.height, textFrame.size.height);
      borderSize.height = MAX(size.height, borderSize.height);
    }

    [layout setFrame:CGRectIntegral(textFrame) view:yself.textView];
    [layout setSize:borderSize view:yself.border options:0];

    return CGSizeMake(size.width, MAX(size.height, sizeWithInsets.height));
  }];
}

- (CGSize)sizeThatFits:(CGSize)size {
  UIEdgeInsets insets = self.allInsets;
  CGSize sizeThatFits = [KBText sizeThatFits:CGSizeMake(size.width - insets.left - insets.right, 0) textView:self.textView];
  CGSize sizeWithInsets = CGSizeMake(sizeThatFits.width + insets.left + insets.right, sizeThatFits.height + insets.top + insets.bottom);
  if (self.verticalAlignment == KBVerticalAlignmentMiddle) {
    sizeWithInsets.height = MAX(size.height, sizeWithInsets.height);
  }
  return sizeWithInsets;
}

- (UIEdgeInsets)allInsets {
  return UIEdgeInsetsAdd(self.border ? self.border.insets : UIEdgeInsetsZero, self.insets);
}

// Don't capture mouse events unless we are selectable
- (NSView *)hitTest:(NSPoint)p {
  if (_textView.selectable) return [super hitTest:p];
  return nil;
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%@ %@", super.description, self.attributedText];
}

+ (instancetype)label {
  return [[KBLabel alloc] init];
}

+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style {
  KBLabel *label = [[KBLabel alloc] init];
  [label setText:text style:style];
  return label;
}

+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBLabel *label = [[KBLabel alloc] init];
  [label setText:text style:style alignment:alignment lineBreakMode:lineBreakMode];
  return label;
}

+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style verticalAlignment:(KBVerticalAlignment)verticalAlignment {
  KBLabel *label = [[KBLabel alloc] init];
  [label setText:text style:style];
  label.verticalAlignment = verticalAlignment;
  [label kb_setBackgroundColor:NSColor.redColor];
  return label;
}

+ (instancetype)labelWithText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBLabel *label = [[KBLabel alloc] init];
  [label setText:text style:style options:options alignment:alignment lineBreakMode:lineBreakMode];
  return label;
}

- (void)setBorderEnabled:(BOOL)borderEnabled {
  if (borderEnabled) {
    _border = [[KBBorder alloc] init];
    [self addSubview:_border];
  } else {
    [_border removeFromSuperview];
    _border = nil;
  }
}

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width {
  [self setBorderEnabled:YES];
  _border.color = color;
  _border.width = width;
  [self setNeedsLayout];
}

- (void)setSelectable:(BOOL)selectable {
  _textView.selectable = selectable;
}

- (BOOL)selectable {
  return _textView.selectable;
}

- (BOOL)mouseDownCanMoveWindow {
  return !self.selectable;
}

- (BOOL)hasText {
  return (self.attributedText && self.attributedText.length > 0);
}

- (void)setText:(NSString *)text style:(KBTextStyle)style {
  [self setText:text style:style alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setText:(NSString *)text style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setText:text style:style options:0 alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  _style = style;
  _options = options;
  id<KBAppearance> appearance = KBAppearance.currentAppearance;
  NSColor *color = [appearance textColorForStyle:style options:options];
  NSFont *font = [appearance fontForStyle:style options:options];
  [self setText:text font:font color:color alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment {
  [self setText:text font:font color:color alignment:alignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSParameterAssert(font);
  NSParameterAssert(color);
  if (!text) {
    self.attributedText = nil;
    return;
  }
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;

  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:font, NSParagraphStyleAttributeName:paragraphStyle};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];

  self.attributedText = str;
}

- (void)setMarkup:(NSString *)markup {
  [self setMarkup:markup font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setMarkup:(NSString *)markup options:(NSDictionary *)options {
  [self setAttributedText:[KBText parseMarkup:markup options:options]];
}

- (void)setMarkup:(NSString *)markup style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  _style = style;
  [self setMarkup:markup font:[KBAppearance.currentAppearance fontForStyle:_style options:0] color:[KBAppearance.currentAppearance textColorForStyle:_style options:0] alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSAttributedString *str = [KBText parseMarkup:markup font:font color:color alignment:alignment lineBreakMode:lineBreakMode];
  [self setAttributedText:str];
}

- (void)setAttributedText:(NSMutableAttributedString *)attributedText alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;
  [attributedText addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, attributedText.length)];
  [self setAttributedText:attributedText];
}

- (void)setFont:(NSFont *)font color:(NSColor *)color {
  NSMutableAttributedString *str = [_attributedText mutableCopy];

  if (font) {
    [str removeAttribute:NSFontAttributeName range:NSMakeRange(0, str.length)];
    [str addAttribute:NSFontAttributeName value:font range:NSMakeRange(0, str.length)];
  }
  if (color) {
    [str removeAttribute:NSForegroundColorAttributeName range:NSMakeRange(0, str.length)];
    [str addAttribute:NSForegroundColorAttributeName value:color range:NSMakeRange(0, str.length)];
  }

  [self setAttributedText:str];
}

- (void)setStyle:(KBTextStyle)style options:(KBTextOptions)options appearance:(id<KBAppearance>)appearance {
  _style = style;
  _options = options;
  [self setFont:[appearance fontForStyle:_style options:options] color:[appearance textColorForStyle:_style options:options]];
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  if (!attributedText) attributedText = [[NSAttributedString alloc] init];
  _attributedText = attributedText;
  NSAssert(_textView.textStorage, @"No text storage");
  [_textView.textStorage setAttributedString:_attributedText];
  _textView.needsDisplay = YES;
  [self setNeedsLayout];
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  //NSAssert(_style != KBTextStyleNone, @"Background style only works if label.style is set");
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  NSColor *color = [appearance textColorForStyle:_style options:_options];
  [self setFont:nil color:color];
  [self setNeedsLayout];
}

@end
