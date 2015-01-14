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

@interface KBTextField : YONSView

@property (nonatomic) NSString *text;
@property (nonatomic) NSString *placeholder;

@end

@interface KBSecureTextField : KBTextField
@end
