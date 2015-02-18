//
//  KBGPGKeyView.h
//  Keybase
//
//  Created by Gabriel on 2/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"

@interface KBGPGKeyView : YONSView

- (void)setGPGKey:(KBRGPGKey *)GPGKey;

@end
