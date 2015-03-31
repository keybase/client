//
//  KBSecretWordsView.h
//  Keybase
//
//  Created by Gabriel on 3/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"

@interface KBSecretWordsView : KBContentView

@property KBButton *button;
@property KBButton *cancelButton;

- (void)setSecretWords:(NSString *)secretWords deviceNameToRegister:(NSString *)deviceNameToRegister;

@end
