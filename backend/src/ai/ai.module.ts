import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

