//
//  KBPGPEncryptView.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBContentView.h"
#import "KBUserPickerView.h"

@interface KBPGPEncryptView : KBContentView <KBUserPickerViewDelegate>

- (void)addUsername:(NSString *)username;

- (void)setText:(NSString *)text;

@end
