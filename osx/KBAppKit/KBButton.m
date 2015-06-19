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
@property KBButtonOptions options;
@end

@interface KBButtonCell ()
@property (weak) KBButton *parent;
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

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options {
  return [self buttonWithText:text style:style options:options alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options targetBlock:(dispatch_block_t)targetBlock {
  KBButton *button = [self buttonWithText:text style:style options:options alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  button.targetBlock = targetBlock;
  return button;
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  return [self buttonWithText:text style:style options:0 alignment:alignment lineBreakMode:lineBreakMode];
}

+ (instancetype)buttonWithText:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  KBButton *button = [[KBButton alloc] init];
  [button setText:text style:style options:options alignment:alignment lineBreakMode:lineBreakMode];
  return button;
}

+ (instancetype)buttonWithAttributedTitle:(NSAttributedString *)attributedTitle style:(KBButtonStyle)style options:(KBButtonOptions)options {
  KBButton *button = [[KBButton alloc] init];
  [button setAttributedTitle:attributedTitle style:style options:options];
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
  return [self buttonWithImage:image style:style options:0];
}

+ (instancetype)buttonWithImage:(NSImage *)image style:(KBButtonStyle)style options:(KBButtonOptions)options {
  KBButton *button = [[KBButton alloc] init];
  KBButtonCell *cell = [button _setCellForStyle:style options:options];
  cell.image = image;
  return button;
}

+ (instancetype)buttonWithText:(NSString *)text image:(NSImage *)image style:(KBButtonStyle)style options:(KBButtonOptions)options {
  KBButton *button = [[KBButton alloc] init];
  KBButtonCell *cell = [button _setCellForStyle:style options:options];
  cell.image = image;
  [cell setText:text alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  return button;
}

- (CGSize)paddingForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {

  if (options & KBButtonOptionsToolbar) {
    if (self.image) {
      return CGSizeMake(24, 0);
    } else {
      return CGSizeMake(16, 0);
    }
  }

  switch (self.style) {
    case KBButtonStyleCheckbox:
    case KBButtonStyleText:
    case KBButtonStyleLink:
    case KBButtonStyleEmpty:
      return CGSizeMake(2, 0);

    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
    case KBButtonStyleWarning:
      return CGSizeMake(24, 16);
  }
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
  CGSize padding = [self paddingForStyle:self.style options:self.options];
  sizeThatFits.width += padding.width;
  sizeThatFits.height += padding.height;

  // Min size for default buttons
  if ((self.options & KBButtonOptionsToolbar) != 0) {
    sizeThatFits.height = MAX(sizeThatFits.height, 26);
  } else if (self.style == KBButtonStyleDefault || self.style == KBButtonStylePrimary) {
    sizeThatFits.width = MAX(sizeThatFits.width, 120);
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
  [self setAttributedTitle:[KBButton attributedText:text font:font color:color alignment:alignment lineBreakMode:lineBreakMode] style:KBButtonStyleText options:0];
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setText:text style:style options:0 font:font alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options {
  [self setText:text style:style options:options alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options font:(NSFont *)font alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setAttributedTitle:[KBButton attributedText:text font:font color:nil alignment:alignment lineBreakMode:lineBreakMode] style:style options:options];
}

- (void)changeText:(NSString *)text style:(KBButtonStyle)style {
  self.style = style;
  [self.cell changeText:text style:style];
  [self setNeedsDisplay];
}

+ (KBButtonCell *)buttonCellWithStyle:(KBButtonStyle)style options:(KBButtonOptions)options button:(KBButton *)button {
  KBButtonCell *cell = [[KBButtonCell alloc] init];
  cell.style = style;
  cell.options = options;
  cell.parent = button;
  cell.target = button;
  cell.action = @selector(_performTargetBlock);
  cell.backgroundStyle = NSBackgroundStyleLight;
  return cell;
}

- (KBButtonCell *)_setCellForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  _style = style;
  _options = options;
  KBButtonCell *cell = [KBButton buttonCellWithStyle:style options:options button:self];
  self.cell = cell;
  if (style == KBButtonStyleCheckbox) {
    [self setButtonType:NSSwitchButton];
  } else if (options & KBButtonOptionsToggle) {
    [self setButtonType:NSPushOnPushOffButton];
  }
  return cell;
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  [self setText:text style:style options:0 alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setText:(NSString *)text style:(KBButtonStyle)style options:(KBButtonOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  if (!self.identifier) self.identifier = text; // Default identifier for debug

  KBButtonCell *cell = [self _setCellForStyle:style options:options];
  [cell setText:text alignment:alignment lineBreakMode:lineBreakMode];
  [self setNeedsDisplay];
}

- (void)setAttributedTitle:(NSAttributedString *)attributedTitle style:(KBButtonStyle)style options:(KBButtonOptions)options {
  KBButtonCell *cell = [self _setCellForStyle:style options:options];
  [cell setAttributedTitle:attributedTitle];
  [self setNeedsDisplay];
}

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment {
  KBButtonCell *cell = [self _setCellForStyle:style options:0];
  [cell setMarkup:markup style:style font:font alignment:alignment];
  [self setNeedsDisplay];
}

- (void)_performTargetBlock {
  if (self.targetBlock) self.targetBlock();
  if (self.dispatchBlock) {
    self.enabled = NO;
    self.dispatchBlock(self, ^() {
      self.enabled = YES;
    });
  }
}

+ (NSFont *)fontForStyle:(KBButtonStyle)style options:(KBButtonOptions)options {
  if ((options & KBButtonOptionsToolbar) != 0) return [KBAppearance.currentAppearance textFont];
  switch (style) {
    case KBButtonStyleDefault:
    case KBButtonStylePrimary:
    case KBButtonStyleDanger:
    case KBButtonStyleWarning:
      return [KBAppearance.currentAppearance buttonFont];

    case KBButtonStyleLink:
    case KBButtonStyleText:
    case KBButtonStyleCheckbox:
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
  self.attributedTitle = [KBButton attributedText:text font:[KBButton fontForStyle:self.style options:self.options] color:[KBAppearance.currentAppearance textColor] alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)changeText:(NSString *)text style:(KBButtonStyle)style {
  NSMutableAttributedString *str = [self.attributedTitle mutableCopy];
  [str replaceCharactersInRange:NSMakeRange(0, text.length) withString:text];
  self.style = style;
  self.attributedTitle = str;
}

- (void)setMarkup:(NSString *)markup style:(KBButtonStyle)style font:(NSFont *)font alignment:(NSTextAlignment)alignment {
  NSAttributedString *str = [KBText parseMarkup:markup font:font ? font : [KBButton fontForStyle:style options:self.options] color:nil alignment:alignment lineBreakMode:NSLineBreakByWordWrapping];
  [self setAttributedTitle:str];
}

- (NSRect)drawTitle:(NSAttributedString *)title withFrame:(NSRect)frame inView:(NSView*)controlView {
  if (self.style != KBButtonStyleText) {
    // Cache this?
    NSMutableAttributedString *titleCopy = [title mutableCopy];
    NSColor *color = [KBAppearance.currentAppearance buttonTextColorForStyle:self.style options:self.options enabled:self.enabled highlighted:self.highlighted];
    if (color) {
      [titleCopy addAttribute:NSForegroundColorAttributeName value:color range:NSMakeRange(0, titleCopy.length)];
      title = titleCopy;
    }
  }

  if (self.imagePosition != NSImageAbove && self.image && self.style != KBButtonStyleCheckbox) {
    frame.origin.x += self.image.size.width/2.0;
  }

  if ((self.options & KBButtonOptionsToolbar) != 0) {
    frame.origin.y -= 1;
  }

  return [super drawTitle:title withFrame:frame inView:controlView];
}

- (void)drawImage:(NSImage *)image withFrame:(NSRect)frame inView:(NSView *)controlView {
  if (self.style == KBButtonStyleCheckbox) {
    return [super drawImage:image withFrame:frame inView:controlView];
  }

  CGRect imageFrame = frame;
  if (self.imagePosition != NSImageAbove) {
    CGSize titleSize = [KBText sizeThatFits:controlView.frame.size attributedString:self.attributedTitle];

    if (titleSize.width > 0) {
      CGSize controlSize = controlView.frame.size;
      CGPoint imagePosition = CGPointMake(ceilf(controlSize.width/2.0 - titleSize.width/2.0 - image.size.width/2.0) - 2, ceilf(controlSize.height/2.0 - image.size.height/2.0));
      imageFrame = CGRectMake(imagePosition.x, imagePosition.y, image.size.width, image.size.height);
    } else {
      CGSize controlSize = controlView.frame.size;
      controlSize.width += 1;
      controlSize.height += 1;
      CGPoint imagePosition = CGPointMake(floorf(controlSize.width/2.0 - image.size.width/2.0), floorf(controlSize.height/2.0 - image.size.height/2.0));
      imageFrame = CGRectMake(imagePosition.x, imagePosition.y, image.size.width, image.size.height);
    }
  }

  [super drawImage:image withFrame:imageFrame inView:controlView];
}

- (void)drawBezelWithFrame:(NSRect)frame inView:(NSView *)controlView {
  NSColor *strokeColor = [KBAppearance.currentAppearance buttonStrokeColorForStyle:self.style options:self.options enabled:self.enabled highlighted:self.highlighted];
  NSColor *fillColor = [KBAppearance.currentAppearance buttonFillColorForStyle:self.style options:self.options enabled:self.enabled highlighted:self.highlighted toggled:((self.parent.options & KBButtonOptionsToggle) ? self.state : NSOffState)];

  NSBezierPath *path;
  if (strokeColor) {
    path = [NSBezierPath bezierPathWithRoundedRect:CGRectInset(frame, 0.5, 0.5) xRadius:4.0 yRadius:4.0];
    path.lineWidth = 1.0;
  } else if (_style != KBButtonStyleEmpty) {
    path = [NSBezierPath bezierPathWithRoundedRect:frame xRadius:4.0 yRadius:4.0];
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
