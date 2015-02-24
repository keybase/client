//
//  KBTextField.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTextField.h"

#import "KBAppearance.h"

@interface KBNSTextField : NSTextField
@property (weak) id<KBTextFieldFocusDelegate> focusDelegate;
@end

@interface KBNSSecureTextField : NSSecureTextField
@property (weak) id<KBTextFieldFocusDelegate> focusDelegate;
@end

@interface KBTextField ()
@property NSTextField *textField;
@property NSBox *box;
@property BOOL focused;
@end

@implementation KBTextField

- (void)viewInit {
  [self viewInit:NO];
}

- (void)viewInit:(BOOL)secure {
  if (secure) {
    KBNSSecureTextField *textField = [[KBNSSecureTextField alloc] init];
    textField.focusDelegate = self;
    _textField = textField;
  } else {
    KBNSTextField *textField = [[KBNSTextField alloc] init];
    textField.focusDelegate = self;
    _textField = textField;
  }
  _textField.bordered = NO;
  _textField.focusRingType = NSFocusRingTypeNone;
  _textField.font = [NSFont systemFontOfSize:18];
  [self addSubview:_textField];

  _box = [[NSBox alloc] init];
  _box.borderColor = [KBAppearance.currentAppearance lineColor];
  _box.borderWidth = 1;
  _box.frame = CGRectMake(0, 0, 0, 1);
  _box.borderType = NSLineBorder;
  _box.boxType = NSBoxCustom;
  [self addSubview:_box];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout setFrame:CGRectMake(0, 0, size.width, 26) view:yself.textField].size.height + 2;
    [layout setFrame:CGRectMake(0, y - yself.box.frame.size.height + 0.5, size.width, yself.box.frame.size.height) view:yself.box];
    y += 2;
    return CGSizeMake(size.width, y);
  }];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%@: %@", self.className, self.text ? self.text : self.placeholder];
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

- (void)textField:(NSTextField *)textField didChangeFocus:(BOOL)focused {
  _focused = focused;
//  GHDebug(@"Focused: %@ (%@)", @(focused), self.placeholder);
//  _box.borderColor = focused ? [KBAppearance.currentAppearance selectColor] : [KBAppearance.currentAppearance lineColor];
//  CGRect r = _box.frame;
//  r.size = CGSizeMake(_box.frame.size.width, focused ? 2.0 : 1.0);
//  _box.frame = r;
}

- (void)textField:(NSTextField *)textField didChangeEnabled:(BOOL)enabled {
  if (enabled && _focused) {
//    _box.borderColor = [KBAppearance.currentAppearance selectColor];
  } else if (!enabled && _focused) {
//    _box.borderColor = [KBAppearance.currentAppearance lineColor];
  }
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

@implementation KBNSTextField

- (BOOL)becomeFirstResponder {
  BOOL responder = [super becomeFirstResponder];
  [self.focusDelegate textField:self didChangeFocus:[self checkResponder:@"Become"]];
  return responder;
}

- (BOOL)resignFirstResponder {
  BOOL resigned = [super resignFirstResponder];
  [self.focusDelegate textField:self didChangeFocus:[self checkResponder:@"Resign"]];
  return resigned;
}

- (void)setEnabled:(BOOL)enabled {
  [super setEnabled:enabled];
  [self.focusDelegate textField:self didChangeEnabled:enabled];
}

- (BOOL)checkResponder:(NSString *)reason {
  id firstResponder = [[NSApp keyWindow] firstResponder];

  if ([firstResponder isKindOfClass:NSText.class]) {
    firstResponder = (id)[(NSText *)firstResponder delegate];
  }

  BOOL isSelf = (firstResponder == self);
  NSString *description = [firstResponder description];
  if ([firstResponder respondsToSelector:@selector(placeholderString)]) description = [firstResponder placeholderString];
  //GHDebug(@"[%@] First responder: %@ (%@); %@", reason, firstResponder, description, @(isSelf));
  return isSelf;
}

- (void)textDidEndEditing:(NSNotification *)notification {
  [super textDidEndEditing:notification];
  [self.focusDelegate textField:self didChangeFocus:[self checkResponder:@"Resign"]];
}

@end

@implementation KBNSSecureTextField

- (BOOL)becomeFirstResponder {
  [self.focusDelegate textField:self didChangeFocus:YES];
  return [super becomeFirstResponder];
}

- (void)textDidEndEditing:(NSNotification *)notification {
  [super textDidEndEditing:notification];
  [self.focusDelegate textField:self didChangeFocus:NO];
}

@end