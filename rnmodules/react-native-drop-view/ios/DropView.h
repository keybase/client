#import "../../../shared/ios/Keybase/ItemProviderHelper.h"
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface DropView : UIView <UIDropInteractionDelegate>
@property(nonatomic, strong) ItemProviderHelper *iph;
@property(nonatomic, copy) RCTBubblingEventBlock onDropped;
@end
