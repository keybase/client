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

- (void)setSecretWords:(NSString *)secretWords deviceName:(NSString *)deviceName;

@end
