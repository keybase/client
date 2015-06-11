//
//  KBEnvSelectView.h
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import "KBContentView.h"
#import "KBEnvironment.h"

typedef void (^KBEnvSelect)(KBEnvironment *environment);

@interface KBEnvSelectView : KBContentView

@property (copy) KBEnvSelect onSelect;

@end
