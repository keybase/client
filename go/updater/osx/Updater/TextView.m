//
//  TextView.m
//  Updater
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "TextView.h"

@interface KBNSTextView : NSTextView
@property (weak) TextView *parent;
@end

@interface TextView () <NSTextViewDelegate>
@property KBNSTextView *view;
@end

@implementation TextView

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
  _view.editable = YES;
  _view.delegate = self;

  [self setDocumentView:_view];
  self.hasVerticalScroller = YES;
  self.verticalScrollElasticity = NSScrollElasticityAllowed;
  self.autohidesScrollers = YES;
}

// Adding this method and passing to super makes responsive scroll work correctly.
// Without this method scrolling using trackpad is slow and chunky.
// AppKit checks if this method is being overridden by a subclass, which works around the issue somehow.
- (void)scrollWheel:(NSEvent *)event {
  [super scrollWheel:event];
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

- (void)setEnabled:(BOOL)enabled {
  _view.selectable = enabled;
  _view.editable = enabled;
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%@ %@", super.description, self.attributedText];
}

- (NSString *)text {
  return [_view.textStorage string];
}

- (void)setText:(NSString *)text {
  _view.string = text ? text : @"";
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  if (!attributedText) attributedText = [[NSAttributedString alloc] initWithString:@""];
  NSAssert(_view.textStorage, @"No text storage");
  [_view.textStorage setAttributedString:attributedText];
  _view.needsDisplay = YES;
}

- (NSAttributedString *)attributedText {
  return _view.textStorage;
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color  {
  [self setText:text font:font color:color alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
}

- (void)setText:(NSString *)text font:(NSFont *)font color:(NSColor *)color alignment:(NSTextAlignment)alignment lineBreakMode:(NSLineBreakMode)lineBreakMode {
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

- (BOOL)isEditable {
  return _view.isEditable;
}

- (void)setEditable:(BOOL)editable {
  [_view setEditable:editable];
}

// Returns YES if you should call super paste (use the default paste impl)
- (BOOL)onPasted {
  BOOL paste = YES;
  if (self.onPaste) paste = self.onPaste(self);
  [self didChange];
  return paste;
}

- (void)didChange {
  if (self.onChange) self.onChange(self);
}

#pragma mark NSTextViewDelegate

- (void)textDidChange:(NSNotification *)notification {
  [self didChange];
}

@end


@implementation KBNSTextView

- (void)paste:(id)sender {
  if ([self.parent onPasted]) [super paste:sender];
}

@end