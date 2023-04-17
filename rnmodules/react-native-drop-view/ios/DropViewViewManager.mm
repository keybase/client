#import "../../../shared/ios/Keybase/ItemProviderHelper.h"
#import "RCTBridge.h"
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>

#pragma mark DropView
@interface DropView : UIView <UIDropInteractionDelegate>
@property(nonatomic, strong) ItemProviderHelper *iph;
@property(nonatomic, copy) RCTBubblingEventBlock onDropped;
@end

@implementation DropView

- (id)init {
  if (self = [super init]) {
    UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
    udi.allowsSimultaneousDropSessions = YES;
    [self addInteraction:udi];
  }
  return self;
}

- (id)initWithCoder:(NSCoder *)coder {
  if (self = [super initWithCoder:coder]) {
    UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
    udi.allowsSimultaneousDropSessions = YES;
    [self addInteraction:udi];
  }
  return self;
}

- (id)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    UIDropInteraction *udi = [[UIDropInteraction alloc] initWithDelegate:self];
    udi.allowsSimultaneousDropSessions = YES;
    [self addInteraction:udi];
  }
  return self;
}

- (BOOL)dropInteraction:(UIDropInteraction *)interaction
       canHandleSession:(id<UIDropSession>)session {
  return YES;
}

- (UIDropProposal *)dropInteraction:(UIDropInteraction *)interaction
                   sessionDidUpdate:(id<UIDropSession>)session {
  return [[UIDropProposal alloc] initWithDropOperation:UIDropOperationCopy];
}

- (void)dropInteraction:(UIDropInteraction *)interaction
            performDrop:(id<UIDropSession>)session {
  NSMutableArray *items =
      [NSMutableArray arrayWithCapacity:session.items.count];
  [session.items
      enumerateObjectsUsingBlock:^(id obj, NSUInteger idx, BOOL *stop) {
        UIDragItem *i = obj;
        [items addObject:i.itemProvider];
      }];
  __weak __typeof(self) weakSelf = self;
  self.iph = [[ItemProviderHelper alloc]
           initForShare:false
              withItems:items
             attrString:@""
      completionHandler:^{
        if (weakSelf.onDropped != nil) {
          weakSelf.onDropped(@{@"manifest" : weakSelf.iph.manifest});
        }
        weakSelf.iph = nil;
      }];
  [self.iph startProcessing];
}

@end

@interface DropViewViewManager : RCTViewManager
@end

@implementation DropViewViewManager

RCT_EXPORT_MODULE(DropViewView)

- (UIView *)view {
  DropView *dv = [[DropView alloc] init];
  return dv;
}

@end
