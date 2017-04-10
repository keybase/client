//
//  KBMountDir.h
//  KBKit
//
//  Created by Gabriel on 8/24/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBInstallable.h"
#import "KBEnvConfig.h"
#import "KBHelperTool.h"

@interface KBMountDir : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool;

@end
