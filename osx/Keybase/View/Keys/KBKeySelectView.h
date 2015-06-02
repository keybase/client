//
//  KBKeySelectView.h
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBRPC.h"
#import "KBGPGKeysView.h"
#import "KBContentView.h"

@interface KBKeySelectView : KBContentView

@property (copy) MPRequestCompletion completion;

- (void)setGPGKeys:(NSArray *)GPGKeys;

@end
