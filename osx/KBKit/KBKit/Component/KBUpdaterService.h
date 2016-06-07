//
//  KBUpdaterService.h
//  KBKit
//
//  Created by Gabriel on 6/7/16.
//
//

#import <Foundation/Foundation.h>

#import "KBInstallable.h"
#import "KBEnvConfig.h"

@interface KBUpdaterService : KBInstallable

- (instancetype)initWithConfig:(KBEnvConfig *)config label:(NSString *)label servicePath:(NSString *)servicePath;

@end
