//
//  KBRPClient.h
//  Keybase
//
//  Created by Gabriel on 12/12/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRObject.h"

typedef NS_ENUM(NSInteger, KBRPClientStatus) {
  KBRPClientStatusClosed,
  KBRPClientStatusOpenning,
  KBRPClientStatusOpen,
};

@class KBRPClient;

@protocol KBRPClientDelegate <NSObject>
- (void)client:(KBRPClient *)client didReceiveObject:(KBRObject *)object;
- (void)client:(KBRPClient *)client didError:(NSError *)error;
- (void)client:(KBRPClient *)client didChangeStatus:(KBRPClientStatus)status;
@end

@interface KBRPClient : NSObject <NSStreamDelegate>

@property (weak) id<KBRPClientDelegate> delegate;
@property (readonly, nonatomic) KBRPClientStatus status;

- (void)open;
- (void)close;

- (void)writeObject:(KBRObject *)object;

@end
