//
//  KBButton.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBButton.h"

#import "KBAppearance.h"
#import "KBLabel.h"

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

+ (instancetype)button {
  return [KBButton buttonWithText:nil style:KBButtonStyleEmpty];
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style {
  return [self buttonWithText:text style:style alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBButton *button = [[KBButton alloc] init];
  [button setText:text style:style alignment:alignment lineBreakMode:lineBreakMode];
  return button;
}

+ (instancetype)linkWithText:(NSString *)text targetBlock:(dispatch_block_t)targetBlock {
  KBButton *button = [[KBButton alloc] init];
  [button setText:text style:KBButtonStyleLink alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = targetBlock;
  return button;
}

+ (instancetype)buttonWithImage:(NSImage *)image {
  return [self buttonWithImage:image style:KBButtonStyleEmpty];
}

+ (instancetype)buttonWithImage:(NSImage *)image style:(KBButtonStyle)style {
  KBButton *button = [[KBButton alloc] init];
  KBButtonCell *cell = [button _setCellForStyle:style];
  cell.image = image;
  return button;
}

- (CGSize)sizeThatFits:(NSSize)size {
  CGSize sizeThatFits = [KBLabel sizeThatFits:size attributedString:self.attributedTitle];
  switch (self.style) {
    case KBButtonStyleText:
    case KBButtonStyleLink:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      sizeThatFits.width += 4;
      sizeThatFits.height += 2;
      break;

    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      // Padding for non text style buttons
      sizeThatFits.height += 10;
      sizeThatFits.width += 20;
      break;

    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
      // Padding for non text style buttons
      sizeThatFits.height += 20;
      sizeThatFits.width += 40;
      sizeThatFits.width = MAX(sizeThatFits.width, 130); // Min width 120
      break;

  }
  return sizeThatFits;
}

+ (NSMutableAttributedString *)attributedText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  if (!text) text = @"";
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];
  NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
  if (font) attributes[NSFontAttributeName] = font;
  if (color) attributes[NSForegroundColorAttributeName] = color;
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];

  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
  paragraphStyle.alignment = alignment;
  paragraphStyle.lineBreakMode = lineBreakMode;
  [str addAttribute:NSParagraphStyleAttributeName value:paragraphStyle range:NSMakeRange(0, str.length)];
  return str;
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setAttributedTitle:[KBButton attributedText:text font:font color:color alignment:alignment lineBreakMode:lineBreakMode] style:KBButtonStyleText];
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setAttributedTitle:[KBButton attributedText:text font:font color:nil alignment:alignment lineBreakMode:lineBreakMode] style:style];
}

+ (KBButtonCell *)buttonCellWithStyle:(KBButtonStyle)style sender:(id)sender {
  KBButtonCell *cell = [[KBButtonCell alloc] init];
  cell.style = style;
  cell.target = sender;
  cell.action = @selector(_performTargetBlock);
  return cell;
}

- (KBButtonCell *)_setCellForStyle:(KBButtonStyle)style {
  _style = style;
  KBButtonCell *cell = [KBButton buttonCellWithStyle:style sender:self];
  self.cell = cell;
  if (style == KBButtonStyleCheckbox) {
    [self setButtonType:NSSwitchButton];
  }
  return cell;
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBButtonCell *cell = [self _setCellForStyle:style];
  [cell setText:text alignment:alignment lineBreakMode:lineBreakMode];
  [self setNeedsDisplay];
}

- (void)setAttributedTitle:(NSAttributedString *)attributedTitle style:(KBButtonStyle)style {
  KBButtonCell *cell = [self _setCellForStyle:style];
  [cell setAttributedTitle:attributedTitle];
  [self setNeedsDisplay];
}

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment {
  KBButtonCell *cell = [self _setCellForStyle:style];
  [cell setMarkup:markup style:style font:font alignment:alignment];
  [self setNeedsDisplay];
}

static KBButtonErrorHandler gErrorHandler = nil;

- (void)_performTargetBlock {
  if (self.targetBlock) self.targetBlock();
  if (self.dispatchBlock) {
    self.enabled = NO;
    self.dispatchBlock(self, ^(NSError *error) {
      if (error && gErrorHandler) gErrorHandler(self, error);
      self.enabled = YES;
    });
  }
}

+ (void)setErrorHandler:(KBButtonErrorHandler)errorHandler {
  gErrorHandler = errorHandler;
}

+ (NSFont *)fontForStyle:(KBButtonStyle)style {
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
      return [KBAppearance.currentAppearance buttonFont];

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return [KBAppearance.currentAppearance textFont];

    case KBButtonStyleEmpty:
      return nil;
  }
}

@end


@implementation KBButtonCell

- (instancetype)init {
  if ((self = [super init])) {
    self.bezelStyle = NSInlineBezelStyle;
  }
  return self;
}

- (void)setText:(NSString *)text alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setAttributedTitle:[KBButton attributedText:text font:[KBButton fontForStyle:self.style] color:[KBAppearance.currentAppearance textColor] alignment:alignment lineBreakMode:lineBreakMode]];
}

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment {
  NSAttributedString *str = [KBLabel parseMarkup:markup font:font ? font : [KBButton fontForStyle:style] color:nil alignment:alignment lineBreakMode:NSLineBreakByWordWrapping];
  [self setAttributedTitle:str];
}

- (NSColor *)textColorForState {
  if (!self.enabled) return GHNSColorFromRGB(0x666666);
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return GHNSColorFromRGB(0x333333);

    case KBButtonStylePrimary:
      return GHNSColorFromRGB(0xFFFFFF);

    case KBButtonStyleLink: return self.highlighted ? GHNSColorFromRGB(0x000000) : [KBAppearance.currentAppearance selectColor];
    case KBButtonStyleText: NSAssert(NO, @"Text style shouldn't get here");
    case KBButtonStyleCheckbox: return GHNSColorFromRGB(0x333333);
    case KBButtonStyleEmpty: return nil;
  }
}

- (NSColor *)disabledFillColorForState {
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return GHNSColorFromRGB(0xEFEFEF);

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSColor *)highlightedFillColorForState {
  switch (self.style) {
    case KBButtonStyleEmpty:
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
    case KBButtonStyleLink:
    case KBButtonStyleText:
      return GHNSColorFromRGB(0xCCCCCC);

    case KBButtonStylePrimary:
      return GHNSColorFromRGB(0x286090);

    case KBButtonStyleCheckbox:
      return nil;
  }
}

- (NSColor *)fillColorForState {
  if (!self.enabled) return [self disabledFillColorForState];
  if (self.highlighted) return [self highlightedFillColorForState];
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStyleEmpty:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return !self.enabled ? GHNSColorFromRGB(0xCCCCCC) : (self.highlighted ? GHNSColorFromRGB(0xCCCCCC) : [NSColor colorWithCalibratedWhite:0.99 alpha:1.0]);

    case KBButtonStylePrimary:
      return self.highlighted ? GHNSColorFromRGB(0x286090) : KBAppearance.currentAppearance.selectColor; //GHNSColorFromRGB(0x337AB7);

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
      return nil;
  }
}

- (NSColor *)disabledStrokeColorForState {
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary: return GHNSColorFromRGB(0xCCCCCC);
    case KBButtonStyleLink: return nil;
    case KBButtonStyleText: return nil;
    case KBButtonStyleCheckbox: return nil;
    case KBButtonStyleEmpty: return nil;
    case KBButtonStyleToolbar: return nil;
    case KBButtonStyleSmall: return nil;
  }
}

- (NSColor *)strokeColorForState {
  if (!self.enabled) return [self disabledStrokeColorForState];
  switch (self.style) {
    case KBButtonStyleDefault:
    case KBButtonStyleToolbar:
    case KBButtonStyleSmall:
      return GHNSColorFromRGB(0xCCCCCC);
    case KBButtonStylePrimary:
      return GHNSColorFromRGB(0x2e6da4);

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
    case KBButtonStyleEmpty:
      return nil;
  }
}

- (NSRect)drawTitle:(NSAttributedString *)title withFrame:(NSRect)frame inView:(NSView*)controlView {
  if (self.style != KBButtonStyleText) {
    // Cache this?
    NSMutableAttributedString *titleCopy = [title mutableCopy];
    NSColor *color = self.textColorForState;
    if (color) {
      [titleCopy addAttribute:NSForegroundColorAttributeName value:color range:NSMakeRange(0, titleCopy.length)];
      title = titleCopy;
    }
  }
  return [super drawTitle:title withFrame:frame inView:controlView];
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
