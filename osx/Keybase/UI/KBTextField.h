//
//  KBTextField.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import <YOLayout/YOLayout.h>

@class KBTextField;

@protocol KBTextFieldFocusDelegate
- (void)textField:(KBTextField *)textField didChangeFocus:(BOOL)focused;
@end

@protocol KBNSTextFieldFocusDelegate
- (void)textField:(NSTextField *)textField didChangeFocus:(BOOL)focused;
- (void)textField:(NSTextField *)textField didChangeEnabled:(BOOL)enabled;
@end

@interface KBTextField : YONSView <KBNSTextFieldFocusDelegate>

@property (nonatomic) NSString *text;
@property (nonatomic) NSString *placeholder;
@property (readonly) NSTextField *textField;

@property (nonatomic) NSMutableDictionary *attributes;

@property id<KBTextFieldFocusDelegate> focusDelegate;

@end

@interface KBSecureTextField : KBTextField
@end
