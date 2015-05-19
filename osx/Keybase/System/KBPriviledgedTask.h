//
//  KBPriviledgedTask.h
//  Keybase
//
//  Created by Gabriel on 4/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

// Use priviledged helper tool instead when it makes sense
@interface KBPriviledgedTask : NSObject

- (BOOL)execute:(NSString *)cmd args:(NSArray *)args error:(NSError **)error;

+ (BOOL)execute:(NSString *)cmd args:(NSArray *)args error:(NSError **)error;

@end
