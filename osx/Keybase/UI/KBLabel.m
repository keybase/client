//
//  KBLabel.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabel.h"

#import <Slash/Slash.h>
#import "KBBox.h"
#import "KBAppearance.h"
#import <GHKit/GHKit.h>

@interface KBLabel ()
@property NSTextView *textView;
@property KBLabelStyle style;
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

    UIEdgeInsets insets = UIEdgeInsetsAdd(yself.border.insets, yself.insets);
    CGSize sizeThatFits = [KBLabel sizeThatFits:CGSizeMake(size.width - insets.left - insets.right, size.height - insets.top - insets.bottom) attributedString:self.textView.attributedString];
    CGSize sizeWithInsets = CGSizeMake(sizeThatFits.width + insets.left + insets.right, sizeThatFits.height + insets.top + insets.bottom);

    if (self.verticalAlignment != KBVerticalAlignmentNone) {
      // TODO Top, bottom alignments
      [layout setFrame:CGRectIntegral(CGRectMake(insets.left, size.height/2.0 - sizeThatFits.height/2.0, sizeThatFits.width, sizeThatFits.height)) view:yself.textView];
      [layout setSize:CGSizeMake(sizeWithInsets.width, size.height) view:yself.border options:0];
      return CGSizeMake(sizeWithInsets.width, size.height);
    } else if (self.horizontalAlignment != KBHorizontalAlignmentNone) {
      // TODO Other alignments
      [layout setFrame:CGRectIntegral(CGRectMake(size.width/2.0 - sizeThatFits.width/2.0, insets.top, sizeThatFits.width, sizeThatFits.height)) view:yself.textView];
      [layout setSize:CGSizeMake(size.width, sizeWithInsets.height) view:yself.border options:0];
      return CGSizeMake(size.width, sizeWithInsets.height);
    } else {
      [layout setFrame:CGRectIntegral(CGRectMake(insets.left, insets.top, size.width - insets.left - insets.right, sizeThatFits.height)) view:yself.textView];
      [layout setFrame:CGRectMake(0, 0, size.width, sizeWithInsets.height) view:yself.border options:0];
      return CGSizeMake(size.width, ceilf(sizeWithInsets.height));
    }
  }];
}

// Don't capture mouse events unless we are selectable
- (NSView *)hitTest:(NSPoint)p {
  if (_textView.selectable) return [_textView hitTest:[self convertPoint:p fromView:self]];
  return nil;
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%@ %@", super.description, self.attributedText];
}

+ (instancetype)label {
  return [[KBLabel alloc] init];
}

+ (instancetype)labelWithText:(NSString *)text style:(KBLabelStyle)style {
  KBLabel *label = [[KBLabel alloc] init];
  [label setText:text style:style];
  return label;
}

+ (instancetype)labelWithText:(NSString *)text style:(KBLabelStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBLabel *label = [[KBLabel alloc] init];
  [label setText:text style:style alignment:alignment lineBreakMode:lineBreakMode];
  return label;
}

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width {
  if (!_border) {
    _border = [[KBBorder alloc] init];
    [self addSubview:_border];
  }
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

- (void)setText:(NSString *)text style:(KBLabelStyle)style {
  [self setText:text style:style alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (NSColor *)colorForStyle:(KBLabelStyle)style appearance:(id<KBAppearance>)appearance {
  switch (style) {
    case KBLabelStyleNone:
    case KBLabelStyleDefault:
    case KBLabelStyleHeader:
    case KBLabelStyleHeaderLarge:
      return appearance.textColor;

    case KBLabelStyleSecondaryText:
      return appearance.secondaryTextColor;
  }
}

- (NSFont *)fontForStyle:(KBLabelStyle)style appearance:(id<KBAppearance>)appearance {
  switch (style) {
    case KBLabelStyleNone:
    case KBLabelStyleDefault:
      return appearance.textFont;

    case KBLabelStyleSecondaryText: return appearance.textFont;
    case KBLabelStyleHeader: return appearance.headerTextFont;
    case KBLabelStyleHeaderLarge: return appearance.headerLargeTextFont;
  }
}

- (void)setText:(NSString *)text style:(KBLabelStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  _style = style;
  id<KBAppearance> appearance = KBAppearance.currentAppearance;
  NSColor *color = [self colorForStyle:style appearance:appearance];
  NSFont *font = [self fontForStyle:style appearance:appearance];
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

+ (NSAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  return [self parseMarkup:markup options:@{@"font": font, @"color": color, @"alignment": @(alignment), @"lineBreakMode": @(lineBreakMode)}];
}

+ (NSAttributedString *)parseMarkup:(NSString *)markup options:(NSDictionary *)options {
  NSFont *font = options[@"font"];
  NSColor *color = options[@"color"];
  NSTextAlignment alignment = [options[@"alignment"] integerValue];
  NSLineBreakMode lineBreakMode = [options[@"lineBreakMode"] integerValue];
  CGFloat lineSpacing = [options[@"lineSpacing"] floatValue];

  if (!font) font = KBAppearance.currentAppearance.textFont;
  if (!color) color = KBAppearance.currentAppearance.textColor;

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;
  paragraphStyle.lineSpacing = lineSpacing;

  NSDictionary *defaultStyle = @{NSFontAttributeName:font, NSForegroundColorAttributeName:color, NSParagraphStyleAttributeName:paragraphStyle};

  NSDictionary *style = @{@"$default": defaultStyle,
                          @"p": defaultStyle,
                          //@"h3": @{NSFontAttributeName: [NSFont boldSystemFontOfSize:font.pointSize + 6]},
                          //@"h4": @{NSFontAttributeName: [NSFont boldSystemFontOfSize:font.pointSize + 4]},
                          @"em": @{NSFontAttributeName: [NSFont fontWithName:@"Helvetica Neue Italic" size:font.pointSize]},
                          @"strong": @{NSFontAttributeName: [NSFont boldSystemFontOfSize:font.pointSize]},
                          @"a": @{
                              NSForegroundColorAttributeName: KBAppearance.currentAppearance.selectColor,
                              NSCursorAttributeName: NSCursor.pointingHandCursor
                              },
                          @"ok": @{NSForegroundColorAttributeName: KBAppearance.currentAppearance.okColor},
                          @"error": @{NSForegroundColorAttributeName: KBAppearance.currentAppearance.errorColor},
                          @"thin": @{NSFontAttributeName: [NSFont fontWithName:@"Helvetica Neue Thin" size:font.pointSize]},
                          @"color": @{},
                          };
  NSError *error = nil;
  NSAttributedString *str = [[SLSMarkupParser attributedStringWithMarkup:markup style:style error:&error] mutableCopy];
  if (!str) {
    GHDebug(@"Unable to parse markup: %@; %@", markup, error);
    str = [[NSMutableAttributedString alloc] initWithString:markup attributes:defaultStyle];
  }
  return str;
}

- (void)setMarkup:(NSString *)markup {
  [self setMarkup:markup font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setMarkup:(NSString *)markup options:(NSDictionary *)options {
  [self setAttributedText:[KBLabel parseMarkup:markup options:options]];
}

- (void)setMarkup:(NSString *)markup style:(KBLabelStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  _style = style;
  [self setMarkup:markup font:[self fontForStyle:_style appearance:KBAppearance.currentAppearance] color:[self colorForStyle:_style appearance:KBAppearance.currentAppearance] alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSAttributedString *str = [KBLabel parseMarkup:markup font:font color:color alignment:alignment lineBreakMode:lineBreakMode];
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

- (void)setStyle:(KBLabelStyle)style appearance:(id<KBAppearance>)appearance {
  _style = style;
  [self setFont:[self fontForStyle:_style appearance:appearance] color:[self colorForStyle:_style appearance:appearance]];
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  if (!attributedText) attributedText = [[NSAttributedString alloc] init];
  _attributedText = attributedText;
  NSAssert(_textView.textStorage, @"No text storage");
  [_textView.textStorage setAttributedString:_attributedText];
  _textView.needsDisplay = YES;
  [self setNeedsLayout];
}

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString {
  if (size.height <= 0) size.height = CGFLOAT_MAX;
  if (size.width <= 0) size.width = CGFLOAT_MAX;
  NSTextStorage *textStorage = [[NSTextStorage alloc] initWithAttributedString:attributedString];
  NSTextContainer *textContainer = [[NSTextContainer alloc] initWithContainerSize:size];
  [textContainer setLineFragmentPadding:0.0];
  NSLayoutManager *layoutManager = [[NSLayoutManager alloc] init];
  [layoutManager addTextContainer:textContainer];
  [textStorage addLayoutManager:layoutManager];

  // Force layout
  (void)[layoutManager glyphRangeForTextContainer:textContainer];
  NSRect rect = [layoutManager usedRectForTextContainer:textContainer];

  //NSRect rect = [attributedString boundingRectWithSize:size options:NSStringDrawingUsesLineFragmentOrigin];

  return CGRectIntegral(rect).size;
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

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  //NSAssert(_style != KBLabelStyleNone, @"Background style only works if label.style is set");
  if (_style == KBLabelStyleNone) return;
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  NSColor *color = [self colorForStyle:_style appearance:appearance];
  [self setFont:nil color:color];
  [self setNeedsLayout];
}

@end
