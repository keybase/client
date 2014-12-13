#import <GRUnit/GRUnit.h>

#import "KBRPClient.h"

@interface KBRPClientTest : GRTestCase
@end

@implementation KBRPClientTest

- (void)test {
  KBRPClient *client = [[KBRPClient alloc] init];
  [client open];
}

@end
