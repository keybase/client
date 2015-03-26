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
@property NSTextView *textView;
@end

@implementation KBTextView

- (void)viewInit {
  [super viewInit];
  self.identifier = self.className;
  _textView = [[NSTextView alloc] init];
  _textView.backgroundColor = NSColor.whiteColor;
  _textView.font = KBAppearance.currentAppearance.textFont;
  _textView.textColor = KBAppearance.currentAppearance.textColor;
  _textView.editable = YES;
  [self addSubview:_textView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    if (size.height == 0) size.height = 32;
    [layout setSize:size view:yself.textView options:0];
    return size;
  }];
}

- (BOOL)becomeFirstResponder {
  return [_textView becomeFirstResponder];
}

- (BOOL)resignFirstResponder {
  return [_textView resignFirstResponder];
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%@ %@", super.description, self.attributedText];
}

- (NSString *)text {
   return [_textView.textStorage string];
}

- (void)setText:(NSString *)text {
  [self setAttributedText:[[NSAttributedString alloc] initWithString:text]];
}

- (void)setAttributedText:(NSAttributedString *)attributedText {
  if (!attributedText) attributedText = [[NSAttributedString alloc] init];
  _attributedText = attributedText;
  NSAssert(_textView.textStorage, @"No text storage");
  [_textView.textStorage setAttributedString:_attributedText];
  _textView.needsDisplay = YES;
  [self setNeedsLayout];
}

@end
