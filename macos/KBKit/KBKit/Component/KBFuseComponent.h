//
//  KBFuseInstall.h
//  Keybase
//
//  Created by Gabriel on 5/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBInstallable.h"
#import "KBHelperTool.h"

@interface KBFuseComponent : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool servicePath:(NSString *)servicePath;

- (void)refreshFuseComponent:(void (^)(KBRFuseStatus *fuseStatus, KBComponentStatus *componentStatus))completion;

@end
