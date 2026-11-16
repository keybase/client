//
//  MPLog.h
//  MPMessagePack
//
//  Created by Gabriel on 9/1/16.
//  Copyright © 2016 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, MPLogLevel) {
  MPLogLevelInfo = 30,
  MPLogLevelWarn = 40,
  MPLogLevelError = 50,
};

@protocol MPLog <NSObject>
- (void)log:(MPLogLevel)level format:(NSString *)format, ...;
@end
