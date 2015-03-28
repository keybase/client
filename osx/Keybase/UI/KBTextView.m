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

@interface KBTextView ()
@property NSTextView *view;
@end

@implementation KBTextView

- (instancetype)initWithFrame:(NSRect)frameRect {
  if ((self = [super initWithFrame:frameRect])) {
    [self viewInit];
  }
  return self;
}

- (void)viewInit {
  self.identifier = self.className;
  _view = [[NSTextView alloc] init];
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
  id<KBAppearance> appearance = KBAppearance.currentAppearance;
  NSColor *color = [appearance colorForStyle:style];
  NSFont *font = [appearance fontForStyle:style];
  [self setText:text font:font color:color];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color {
  NSParameterAssert(font);
  NSParameterAssert(color);
  if (!text) {
    self.attributedText = nil;
    return;
  }
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:text];

//  NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
//  paragraphStyle.alignment = alignment;
//  paragraphStyle.lineBreakMode = lineBreakMode;

  NSDictionary *attributes = @{NSForegroundColorAttributeName:color, NSFontAttributeName:font}; //, NSParagraphStyleAttributeName:paragraphStyle};
  [str setAttributes:attributes range:NSMakeRange(0, str.length)];

  self.attributedText = str;
}

@end
