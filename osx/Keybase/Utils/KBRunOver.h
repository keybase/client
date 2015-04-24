//
//  KBRunOver.h
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"
#import "KBWork.h"

typedef void (^KBRunOverCompletion)(NSArray */*of KBWork*/work);

@interface KBRunOver : NSObject

@property NSArray *objects;
@property (copy) KBWorkBlock work;
@property (copy) KBRunOverCompletion completion;

- (void)run;

- (void)run:(dispatch_queue_t)queue;

@end
