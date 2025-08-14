#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

@interface DropView : UIView <UIDropInteractionDelegate>
@property(nonatomic, copy) RCTBubblingEventBlock onDropped;
@end
