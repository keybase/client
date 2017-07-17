//
//  Utils.h
//  Keybase
//
//  Created by Chris Nojima on 8/29/16.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface Utils : NSObject
+ (BOOL)areWeBeingUnitTested; // in a test context
+ (BOOL)areWeBeingUnitTestedRightNow; // currently in a test
@end
