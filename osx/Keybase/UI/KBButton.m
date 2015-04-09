//
//  KBButton.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBButton.h"

#import "KBAppearance.h"
#import "KBText.h"

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
  self.title = @"";
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

+ (instancetype)buttonWithText:(NSString *)text image:(NSImage *)image style:(KBButtonStyle)style {
  KBButton *button = [[KBButton alloc] init];
  KBButtonCell *cell = [button _setCellForStyle:style];
  cell.image = image;
  [cell setText:text alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  return button;
}

- (CGSize)sizeThatFits:(NSSize)size {
  CGSize sizeThatFits = CGSizeZero;
  if (self.image) {
    CGSize imageSize = self.image.size;
    if (!isnan(imageSize.width) && !isnan(imageSize.height)) {
      sizeThatFits.width += imageSize.width;
      sizeThatFits.height += imageSize.height;
    }
  }
  if (self.attributedTitle) {
    CGSize titleSize = [KBText sizeThatFits:size attributedString:self.attributedTitle];
    if (titleSize.width > 0) {
      sizeThatFits.width += titleSize.width;
      sizeThatFits.height = MAX(titleSize.height, sizeThatFits.height);
    }
  }
  switch (self.style) {
    case KBButtonStyleCheckbox:
      sizeThatFits.width += 2;
      break;
    case KBButtonStyleText:
    case KBButtonStyleLink:
    case KBButtonStyleEmpty:
      sizeThatFits.width += 4;
      sizeThatFits.height += 2;
      break;

    case KBButtonStyleToolbar:
      sizeThatFits.height += 8;
      sizeThatFits.width += 20;
      break;

    case KBButtonStyleSmall:
      NSAssert(NO, @"We should remove this?");
      sizeThatFits.height += 0;
      sizeThatFits.width += 0;
      break;

    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
      sizeThatFits.height += 16;
      sizeThatFits.width += 24;
      sizeThatFits.width = MAX(sizeThatFits.width, 120);
      break;

  }
  //NSAssert(!isnan(sizeThatFits.width), @"Width is NaN");
  //NSAssert(!isnan(sizeThatFits.height), @"Height is NaN");
  sizeThatFits.width += _padding.width;
  sizeThatFits.height += _padding.height;
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
    self.title = @"";
  }
  return self;
}

- (void)setText:(NSString *)text alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setAttributedTitle:[KBButton attributedText:text font:[KBButton fontForStyle:self.style] color:[KBAppearance.currentAppearance textColor] alignment:alignment lineBreakMode:lineBreakMode]];
}

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment {
  NSAttributedString *str = [KBText parseMarkup:markup font:font ? font : [KBButton fontForStyle:style] color:nil alignment:alignment lineBreakMode:NSLineBreakByWordWrapping];
  [self setAttributedTitle:str];
}

- (NSRect)drawTitle:(NSAttributedString *)title withFrame:(NSRect)frame inView:(NSView*)controlView {
  if (self.style != KBButtonStyleText) {
    // Cache this?
    NSMutableAttributedString *titleCopy = [title mutableCopy];
    NSColor *color = [KBAppearance.currentAppearance buttonTextColorForStyle:self.style enabled:self.enabled highlighted:self.highlighted];
    if (color) {
      [titleCopy addAttribute:NSForegroundColorAttributeName value:color range:NSMakeRange(0, titleCopy.length)];
      title = titleCopy;
    }
  }

  if (self.image && self.style != KBButtonStyleCheckbox) {
    frame.origin.x += self.image.size.width/2.0;
  }

  return [super drawTitle:title withFrame:frame inView:controlView];
}

- (void)drawImage:(NSImage *)image withFrame:(NSRect)frame inView:(NSView *)controlView {
  if (self.style == KBButtonStyleCheckbox) {
    return [super drawImage:image withFrame:frame inView:controlView];
  }

  CGSize titleSize = [KBText sizeThatFits:controlView.frame.size attributedString:self.attributedTitle];

  CGRect imageFrame = frame;
  if (titleSize.width > 0) {
    CGPoint imagePosition = CGPointMake(ceilf(controlView.frame.size.width/2.0 - titleSize.width/2.0 - image.size.width/2.0) - 2,
                                        ceilf(controlView.frame.size.height/2.0 - image.size.height/2.0));
    imageFrame = CGRectMake(imagePosition.x, imagePosition.y, image.size.width, image.size.height);
  }

  [super drawImage:image withFrame:imageFrame inView:controlView];
}

- (void)drawBezelWithFrame:(NSRect)frame inView:(NSView *)controlView {
  NSColor *strokeColor = [KBAppearance.currentAppearance buttonStrokeColorForStyle:self.style enabled:self.enabled highlighted:self.highlighted];
  NSColor *fillColor = [KBAppearance.currentAppearance buttonFillColorForStyle:self.style enabled:self.enabled highlighted:self.highlighted];

  NSBezierPath *path;
  if (strokeColor) {
    path = [NSBezierPath bezierPathWithRoundedRect:CGRectInset(frame, 0.5, 0.5) xRadius:4.0 yRadius:4.0];
    path.lineWidth = 1.0;
  } else {
    path = [NSBezierPath bezierPathWithRoundedRect:frame xRadius:4.0 yRadius:4.0];
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
