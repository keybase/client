#import "DropView.h"
#import "RCTBridge.h"
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface DropViewViewManager : RCTViewManager
@end

@implementation DropViewViewManager

RCT_EXPORT_MODULE(DropViewView)
RCT_EXPORT_VIEW_PROPERTY(onDropped, RCTBubblingEventBlock)

- (UIView *)view {
  return [[DropView alloc] init];
}

@end
