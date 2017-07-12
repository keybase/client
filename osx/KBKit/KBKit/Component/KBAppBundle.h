//
//  KBAppBundle.h
//  KBKit
//
//  Created by Gabriel on 2/1/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBInstallable.h"
#import "KBHelperTool.h"

@interface KBAppBundle : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool;

@end
