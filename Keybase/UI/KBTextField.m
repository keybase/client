//
//  KBTextField.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTextField.h"

@interface KBTextField ()
@property NSTextField *textField;
@property NSBox *box;
@end

@implementation KBTextField

- (void)viewInit {
  [self viewInit:NO];
}

- (void)viewInit:(BOOL)secure {
  if (secure) {
    _textField = [[NSSecureTextField alloc] init];
  } else {
    _textField = [[NSTextField alloc] init];
  }
  _textField.bordered = NO;
  _textField.focusRingType = NSFocusRingTypeNone;
  _textField.font = [NSFont systemFontOfSize:18];
  [self addSubview:_textField];

  _box = [[NSBox alloc] init];
  _box.borderColor = [NSColor colorWithWhite:0.9 alpha:1.0];
  _box.borderWidth = 1;
  _box.borderType = NSLineBorder;
  _box.boxType = NSBoxCustom;
  [self addSubview:_box];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout setFrame:CGRectMake(0, 0, size.width, 26) view:yself.textField].size.height;
    y += [layout setFrame:CGRectMake(0, y, size.width, 1) view:yself.box].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (BOOL)becomeFirstResponder {
  return [_textField becomeFirstResponder];
}

- (BOOL)resignFirstResponder {
  return [_textField resignFirstResponder];
}

- (BOOL)acceptsFirstResponder {
  return YES;
}

- (BOOL)canBecomeKeyView {
  return YES;
}

- (void)setNextKeyView:(NSView *)nextKeyView {
  [_textField setNextKeyView:nextKeyView];
}

- (void)setText:(NSString *)text {
  _textField.stringValue = text ? text : @"";
}

- (NSString *)text {
  if ([_textField.stringValue isEqualToString:@""]) return nil;
  return _textField.stringValue;
}

- (NSString *)placeholder {
  return _textField.placeholderString;
}

- (void)setPlaceholder:(NSString *)placeholder {
  _textField.placeholderString = placeholder;
}

@end

@implementation KBSecureTextField

- (void)viewInit {
  [self viewInit:YES];
}

@end
