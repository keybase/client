//
//  KBWork.h
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@class KBWork;

@interface KBWork : NSObject

@property (readonly) id input;
@property (readonly) id output;
@property (readonly) NSError *error;

+ (instancetype)workWithInput:(id)input output:(id)output error:(NSError *)error;

@end
