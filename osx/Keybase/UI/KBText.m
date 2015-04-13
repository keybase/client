//
//  KBText.m
//  Keybase
//
//  Created by Gabriel on 3/31/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBText.h"

#import <Slash/Slash.h>
#import <CocoaLumberjack/CocoaLumberjack.h>
#import "KBAppearance.h"

@implementation KBText

+ (CGSize)sizeThatFits:(CGSize)size textView:(NSTextView *)textView {
  return [self sizeThatFits:size attributedString:textView.attributedString];
}

+ (CGSize)sizeThatFits:(CGSize)size attributedString:(NSAttributedString *)attributedString {
  if (size.height <= 0) size.height = CGFLOAT_MAX;
  if (size.width <= 0) size.width = CGFLOAT_MAX;
  NSTextStorage *textStorage = [[NSTextStorage alloc] initWithAttributedString:attributedString];
  NSTextContainer *textContainer = [[NSTextContainer alloc] initWithContainerSize:size];
  [textContainer setLineFragmentPadding:0];
  NSLayoutManager *layoutManager = [[NSLayoutManager alloc] init];
  [layoutManager addTextContainer:textContainer];
  [textStorage addLayoutManager:layoutManager];

  // Force layout
  //(void)[layoutManager glyphRangeForTextContainer:textContainer];
  //NSRect rect = [layoutManager usedRectForTextContainer:textContainer];

  // This seems to be more accurate than usedRectForTextContainer:
  NSRect rect = [attributedString boundingRectWithSize:size options:NSStringDrawingUsesLineFragmentOrigin];

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

+ (NSAttributedString *)parseMarkup:(NSString *)markup font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  return [self parseMarkup:markup options:@{@"font": GHOrNull(font), @"color": GHOrNull(color), @"alignment": @(alignment), @"lineBreakMode": @(lineBreakMode)}];
}

+ (NSAttributedString *)parseMarkup:(NSString *)markup options:(NSDictionary *)options {
  NSFont *font = GHIfNull(options[@"font"], nil);
  NSColor *color = GHIfNull(options[@"color"], nil);
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
    DDLogError(@"Unable to parse markup: %@; %@", markup, error);
    str = [[NSMutableAttributedString alloc] initWithString:markup attributes:defaultStyle];
  }
  return str;
}

@end
