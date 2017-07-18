//
//  KBCommandLineEtcPaths.h
//  KBKit
//
//  Created by Gabriel on 1/18/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBInstallable.h"
#import "KBHelperTool.h"

@interface KBCommandLineEtcPaths : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool servicePath:(NSString *)servicePath;

@end
