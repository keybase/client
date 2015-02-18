//
//  KBTextField.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBUIDefines.h"

@protocol KBTextFieldFocusDelegate
- (void)textField:(NSTextField *)textField didChangeFocus:(BOOL)focused;
@end

@interface KBTextField : YONSView <KBTextFieldFocusDelegate>

@property (nonatomic) NSString *text;
@property (nonatomic) NSString *placeholder;
@property (readonly) NSTextField *textField;

@end

@interface KBSecureTextField : KBTextField
@end
