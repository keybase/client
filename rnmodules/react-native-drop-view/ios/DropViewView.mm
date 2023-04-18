#import "DropViewView.h"
#import "../../../shared/ios/Keybase/ItemProviderHelper.h"
#import <React/RCTUIManager.h>
#import <React/RCTViewManager.h>
#import <react/renderer/components/RNDropViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNDropViewSpec/EventEmitters.h>
#import <react/renderer/components/RNDropViewSpec/Props.h>
#import <react/renderer/components/RNDropViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

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

@interface DropViewView () <RCTDropViewViewProtocol>
@end

@implementation DropViewView {
  UIView *_view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<DropViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const DropViewProps>();
    _props = defaultProps;

    DropView *dv = [[DropView alloc] init];
    _view = dv;

    self.contentView = _view;
  }

  return self;
}

Class<RCTComponentViewProtocol> DropViewCls(void) {
    return DropViewView.class;
    
}

@end
