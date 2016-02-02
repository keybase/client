//
//  KBAppBundle.h
//  KBKit
//
//  Created by Gabriel on 2/1/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBInstallable.h"

@interface KBAppBundle : KBInstallable

- (instancetype)initWithPath:(NSString *)path;

@end
