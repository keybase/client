//
//  KBLabel.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBLabel.h"

#import <Slash/Slash.h>
#import "KBDefines.h"
#import "KBBox.h"

@interface KBLabel ()
@property NSTextView *textView;
@property KBBox *border; // Optional
@end

@implementation KBLabel

- (void)viewInit {
  [super viewInit];
  self.identifier = self.className;
  _textView = [[NSTextView alloc] init];
  _textView.backgroundColor = NSColor.clearColor;
  _textView.editable = NO;
  _textView.selectable = NO;
  _textView.textContainerInset = NSMakeSize(0, 0);
  _textView.textContainer.lineFragmentPadding = 0;
  [self addSubview:_textView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    if (size.height > 0 && self.verticalAlignment == KBVerticalAlignmentMiddle) {
      CGSize textSize = [KBLabel sizeThatFits:size attributedString:self.textView.attributedString];
      [layout setFrame:CGRectIntegral(CGRectMake(0, size.height/2.0 - textSize.height/2.0, textSize.width, textSize.height)) view:yself.textView];
      [layout setSize:CGSizeMake(textSize.width, size.height) view:yself.border options:0];
      return CGSizeMake(textSize.width, size.height);
    } else {
      [layout setSize:size view:yself.textView options:0]; // TODO: Inset
      [layout setSize:size view:yself.border options:0];
      return size;
    }
  }];
}

- (CGSize)sizeThatFits:(CGSize)size {
  CGSize textSize = [KBLabel sizeThatFits:size attributedString:self.textView.attributedString];
  if (size.height > 0 && self.verticalAlignment == KBVerticalAlignmentMiddle) {
    return CGSizeMake(textSize.width, size.height);
  }
  return textSize;
}

- (void)setBorderWithColor:(NSColor *)color width:(CGFloat)width {
  _border = [KBBox roundedWithWidth:1.0 color:GHNSColorFromRGB(0xDDDDDD) cornerRadius:4.0];
  [self addSubview:_border];
  [self setNeedsLayout];
}

- (NSView *)hitTest:(NSPoint)point {
  // TODO call super if selectable?
  return _textView.selectable ? _textView : nil;
}

- (void)setBackgroundColor:(NSColor *)backgroundColor {
  _textView.backgroundColor = backgroundColor;
}

- (void)setSelectable:(BOOL)selectable {
  _textView.selectable = selectable;
}

- (BOOL)selectable {
  return _textView.selectable;
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

+ (NSMutableAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color {
  NSDictionary *style = @{@"$default": @{NSFontAttributeName: font},
                          @"p": @{NSFontAttributeName: font},
                          @"em": @{NSFontAttributeName: [NSFont fontWithName:@"Helvetica Neue Italic" size:font.pointSize]},
                          @"strong": @{NSFontAttributeName: [NSFont boldSystemFontOfSize:font.pointSize]},
                          @"color": @{},
                          };
  NSError *error = nil;
  NSMutableAttributedString *str = [[SLSMarkupParser attributedStringWithMarkup:markup style:style error:&error] mutableCopy];
  if (!str) {
    GHDebug(@"Unable to parse markup: %@; %@", markup, error);
    str = [[NSMutableAttributedString alloc] initWithString:markup attributes:@{NSFontAttributeName: font}];
  }
  if (color) [str addAttribute:NSForegroundColorAttributeName value:color range:NSMakeRange(0, str.length)];
  return str;
}

- (void)setMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSMutableAttributedString *str = [KBLabel parseMarkup:markup font:font color:color];

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
  } else {
    if (_textView.textStorage.length > 0) {
      [_textView.textStorage deleteCharactersInRange:NSMakeRange(0, _textView.textStorage.length)];
    }
  }
  [self setNeedsLayout];
}

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString {
  if (size.height == 0) size.height = CGFLOAT_MAX;
  if (size.width == 0) size.width = CGFLOAT_MAX;
  NSTextStorage *textStorage = [[NSTextStorage alloc] initWithAttributedString:attributedString];
  NSTextContainer *textContainer = [[NSTextContainer alloc] initWithContainerSize:size];
  NSLayoutManager *layoutManager = [[NSLayoutManager alloc] init];
  [layoutManager addTextContainer:textContainer];
  [textStorage addLayoutManager:layoutManager];

  // Force layout
  (void)[layoutManager glyphRangeForTextContainer:textContainer];

  NSRect rect = [layoutManager usedRectForTextContainer:textContainer];
  //rect.size.height += 1; // For descenders to not get clipped? TODO: Fixme

  return CGRectIntegral(rect).size;
}

//- (CGSize)sizeThatFits:(CGSize)size {
//  return [KBLabel sizeThatFits:size attributedString:_textView.attributedString];
//}

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
