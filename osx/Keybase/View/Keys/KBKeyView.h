//
//  KBPGPKeyView.h
//  Keybase
//
//  Created by Gabriel on 3/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBContentView.h"

@interface KBKeyView : KBContentView

- (void)setKey:(KBRFOKID *)key;

@end
