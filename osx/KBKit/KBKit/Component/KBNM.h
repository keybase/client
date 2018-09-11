//
//  KBNM.h
//  KBKit
//
//  Created by Gabriel on 4/6/17.
//  Copyright © 2017 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBComponent.h"
#import "KBInstallable.h"
#import "KBHelperTool.h"

@interface KBNM : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config servicePath:(NSString *)servicePath;

@end
