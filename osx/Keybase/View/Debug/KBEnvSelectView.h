//
//  KBEnvSelectView.h
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBContentView.h"

typedef void (^KBEnvSelect)(KBRPClientEnv env);

@interface KBEnvSelectView : KBContentView

@property (copy) KBEnvSelect onSelect;

@end
