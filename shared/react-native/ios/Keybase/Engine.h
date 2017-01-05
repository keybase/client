//
//  Engine.h
//  Keybase
//
//  Created by Chris Nojima on 8/28/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface Engine : NSObject
- (instancetype)initWithSettings:(NSDictionary *)settings error:(NSError **)error;
@end
