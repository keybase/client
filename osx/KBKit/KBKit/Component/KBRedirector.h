//
//  KBRedirector.h
//  KBKit
//
//  Created by strib on 2/20/18.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBInstallable.h"
#import "KBEnvConfig.h"
#import "KBHelperTool.h"

@interface KBRedirector : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config helperTool:(KBHelperTool *)helperTool servicePath:(NSString *)servicePath;

@end
