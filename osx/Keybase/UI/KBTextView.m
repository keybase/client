//
//  KBTextView.m
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTextView.h"

#import "KBAppearance.h"
#import "KBBorder.h"
#import "KBLabel.h"

@interface KBNSTextView : NSTextView
@property (weak) KBTextView *parent;
@end

@interface KBTextView ()
@property KBNSTextView *view;
@end

@implementation KBTextView

- (instancetype)initWithFrame:(NSRect)frameRect {
  if ((self = [super initWithFrame:frameRect])) {
    [self viewInit];
  }
  return self;
}

- (instancetype)initWithCoder:(NSCoder *)coder {
  if ((self = [super initWithCoder:coder])) {
    [self viewInit];
  }
  return self;
}

- (void)viewInit {
  self.identifier = self.className;
  KBNSTextView *view = [[KBNSTextView alloc] init];
  view.parent = self;
  _view = view;
  _view.autoresizingMask = NSViewHeightSizable|NSViewWidthSizable;
  _view.backgroundColor = NSColor.whiteColor;
  _view.font = KBAppearance.currentAppearance.textFont;
  _view.textColor = KBAppearance.currentAppearance.textColor;
  _view.editable = YES;

  [self setDocumentView:_view];
  self.hasVerticalScroller = YES;
  self.verticalScrollElasticity = NSScrollElasticityAllowed;
  self.autohidesScrollers = YES;
}

- (CGSize)sizeThatFits:(CGSize)size {
  return self.frame.size;
}

- (BOOL)becomeFirstResponder {
  return [_view becomeFirstResponder];
}

- (BOOL)resignFirstResponder {
  return [_view resignFirstResponder];
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%@ %@", super.description, self.attributedText];
}

- (NSString *)text {
   return [_view.textStorage string];
}

- (void)setText:(NSString *)text {
  _view.string = text;
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  if (!attributedText) attributedText = [[NSAttributedString alloc] init];
  NSAssert(_view.textStorage, @"No text storage");
  [_view.textStorage setAttributedString:attributedText];
  _view.needsDisplay = YES;
}

- (NSAttributedString *)attributedText {
  return _view.textStorage;
}

- (void)setText:(NSString *)text style:(KBTextStyle)style {
  [self setText:text style:style alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setText:(NSString *)text style:(KBTextStyle)style alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode  {
  [self setText:text style:style options:0 alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setText:(NSString *)text style:(KBTextStyle)style options:(KBTextOptions)options alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  id<KBAppearance> appearance = KBAppearance.currentAppearance;
  NSColor *color = [appearance colorForStyle:style options:options];
  NSFont *font = [appearance fontForStyle:style options:options];
  [self setText:text font:font color:color alignment:alignment lineBreakMode:lineBreakMode];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color  {
  [self setText:text font:font color:color alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
  if (!font) font = KBAppearance.currentAppearance.textFont;
  if (!color) color = KBAppearance.currentAppearance.textColor;
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

@end


@implementation KBNSTextView

- (void)paste:(id)sender {
  if (self.parent.onPaste) {
    if (self.parent.onPaste(self.parent)) [super paste:sender];
  } else {
    [super paste:sender];
  }
}

@end