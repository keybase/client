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
#import "KBDefines.h"

@interface KBButton ()
@property KBButtonStyle style;
@end

@implementation KBButton

- (instancetype)initWithFrame:(NSRect)frameRect {
  if ((self = [super initWithFrame:frameRect])) { [self viewInit]; }
  return self;
}

- (instancetype)initWithCoder:(NSCoder *)coder {
  if ((self = [super initWithCoder:coder])) { [self viewInit]; }
  return self;
}

- (void)viewInit {
   self.target = self;
   self.action = @selector(_performTargetBlock);
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style {
  return [self buttonWithText:text style:style alignment:NSCenterTextAlignment];
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment {
  KBButton *button = [[KBButton alloc] init];
  [button setText:text style:style alignment:alignment];
  return button;
}

+ (instancetype)buttonWithImage:(NSImage *)image {
  KBButton *button = [[KBButton alloc] init];
  button.image = image;
  button.bordered = NO;
  return button;
}

- (CGSize)sizeThatFits:(NSSize)size {
  CGSize sizeThatFits = [KBLabel sizeThatFits:size attributedString:self.attributedTitle];
  if (self.style == KBButtonStyleLink || self.style == KBButtonStyleCheckbox) {
    return sizeThatFits;
  } else {
    sizeThatFits.height += 20;
    sizeThatFits.width += 40;
    return sizeThatFits;
  }
}

//- (CGSize)sizeThatFits:(CGSize)size {
//  return [KBLabel sizeThatFits:size attributedString:self.attributedTitle];
//}

+ (NSMutableAttributedString *)attributedText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  NSParameterAssert(font);
  NSParameterAssert(color);
  if (!text) text = @"";
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];
  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:font};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  return str;
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setAttributedTitle:[KBButton attributedText:text font:font color:color alignment:alignment lineBreakMode:lineBreakMode]];
}

+ (KBButtonCell *)buttonCellWithStyle:(KBButtonStyle)style sender:(id)sender {
  KBButtonCell *cell = [[KBButtonCell alloc] init];
  cell.style = style;
  cell.target = sender;
  cell.action = @selector(_performTargetBlock);
  return cell;
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment {
  self.style = style;
  KBButtonCell *cell = [KBButton buttonCellWithStyle:style sender:self];
  [cell setText:text alignment:alignment];
  self.cell = cell;
  [self setNeedsDisplay];
}

- (void)setAttributedTitle:(NSAttributedString *)attributedTitle style:(KBButtonStyle)style {
  self.style = style;
  KBButtonCell *cell = [KBButton buttonCellWithStyle:style sender:self];
  [cell setAttributedTitle:attributedTitle];
  self.cell = cell;
  [self setNeedsDisplay];
}

- (void)setTargetBlock:(KBButtonTargetBlock)targetBlock {
  _targetBlock = targetBlock;
}

- (void)_performTargetBlock {
  if (self.targetBlock) self.targetBlock();
}

@end

@implementation KBButtonCell

- (instancetype)init {
  if ((self = [super init])) {
    self.bezelStyle = NSInlineBezelStyle;
  }
  return self;
}

- (void)setText:(NSString *)text alignment:(NSTextAlignment)alignment {
  [self setAttributedTitle:[KBButton attributedText:text font:[self fontForStyle] color:[KBLookAndFeel textColor] alignment:alignment lineBreakMode:NSLineBreakByTruncatingTail]];
}

- (NSFont *)fontForStyle {
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary: return [NSFont systemFontOfSize:18];
    case KBButtonStyleLink: return [NSFont systemFontOfSize:14];
    case KBButtonStyleText: return [NSFont systemFontOfSize:14];
    case KBButtonStyleCheckbox: return [NSFont systemFontOfSize:14];
  }
}

- (NSColor *)textColorForState {
  if (!self.enabled) return GHNSColorFromRGB(0x666666);
  switch (self.style) {
    case KBButtonStyleDefault: return GHNSColorFromRGB(0x333333);
    case KBButtonStylePrimary: return GHNSColorFromRGB(0xFFFFFF);
    case KBButtonStyleLink: return self.highlighted ? GHNSColorFromRGB(0x000000) : [KBLookAndFeel selectColor];
    case KBButtonStyleText: NSAssert(NO, @"Text style shouldn't get here");
    case KBButtonStyleCheckbox: return GHNSColorFromRGB(0x333333);
  }
}

- (NSColor *)disabledFillColorForState {
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
      return GHNSColorFromRGB(0xEFEFEF);
    case KBButtonStyleLink: return nil;
    case KBButtonStyleText: return nil;
    case KBButtonStyleCheckbox: return nil;
  }
}

- (NSColor *)highlightedFillColorForState {
  switch (self.style) {
    case KBButtonStyleDefault: return GHNSColorFromRGB(0xCCCCCC);
    case KBButtonStylePrimary: return GHNSColorFromRGB(0x286090);
    case KBButtonStyleLink: return nil;
    case KBButtonStyleText: return nil;
    case KBButtonStyleCheckbox: return nil;
  }
}

- (NSColor *)fillColorForState {
  if (!self.enabled) return [self disabledFillColorForState];
  if (self.highlighted) return [self highlightedFillColorForState];
  switch (self.style) {
    case KBButtonStyleDefault: return !self.enabled ? GHNSColorFromRGB(0xCCCCCC) : (self.highlighted ? GHNSColorFromRGB(0xCCCCCC) : GHNSColorFromRGB(0xFFFFFF));
    case KBButtonStylePrimary: return self.highlighted ? GHNSColorFromRGB(0x286090) : GHNSColorFromRGB(0x337AB7);
    case KBButtonStyleLink: return nil;
    case KBButtonStyleText: return nil;
    case KBButtonStyleCheckbox: return nil;
  }
}

- (NSColor *)disabledStrokeColorForState {
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary: return GHNSColorFromRGB(0xCCCCCC);
    case KBButtonStyleLink: return nil;
    case KBButtonStyleText: return nil;
    case KBButtonStyleCheckbox: return nil;
  }
}

- (NSColor *)strokeColorForState {
  if (!self.enabled) return [self disabledStrokeColorForState];
  switch (self.style) {
    case KBButtonStyleDefault: return GHNSColorFromRGB(0xCCCCCC);
    case KBButtonStylePrimary: return GHNSColorFromRGB(0x2e6da4);
    case KBButtonStyleLink: return nil;
    case KBButtonStyleText: return nil;
    case KBButtonStyleCheckbox: return nil;
  }
}

- (NSRect)drawTitle:(NSAttributedString *)title withFrame:(NSRect)frame inView:(NSView*)controlView {
  // Cache this?
  NSMutableAttributedString *titleCopy = [title mutableCopy];
  if (self.style != KBButtonStyleText) {
    [titleCopy addAttribute:NSForegroundColorAttributeName value:self.textColorForState range:NSMakeRange(0, titleCopy.length)];
  }
  return [super drawTitle:titleCopy withFrame:frame inView:controlView];
}

- (void)drawBezelWithFrame:(NSRect)frame inView:(NSView *)controlView {
  NSColor *strokeColor = [self strokeColorForState];
  NSColor *fillColor = [self fillColorForState];

  NSBezierPath *path = [NSBezierPath bezierPathWithRoundedRect:CGRectInset(frame, 0.5, 0.5) xRadius:4.0 yRadius:4.0];
  if (strokeColor) {
    path.lineWidth = 1.0;
    //path.flatness = 0;
  }
  if (fillColor) {
    [fillColor setFill];
    [path fill];
  }
  if (strokeColor) {
    [strokeColor setStroke];
    [path stroke];
  }
}

@end
