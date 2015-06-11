//
//  KBKeySelectView.h
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import "KBGPGKeysView.h"
#import "KBContentView.h"

typedef void (^KBKeySelectViewCompletion)(id sender, id response);

@interface KBKeySelectView : KBContentView

@property (copy) KBKeySelectViewCompletion completion;

- (void)setGPGKeys:(NSArray *)GPGKeys;

@end
