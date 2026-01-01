import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { SubscribeDto } from './dto/subscribe.dto';

@ApiTags('Subscription')
@Controller('plans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all subscription plans' })
  async getAllPlans() {
    return this.subscriptionService.getAllPlans();
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to a plan' })
  async subscribe(@CurrentUser() user: any, @Body() subscribeDto: SubscribeDto) {
    return this.subscriptionService.subscribe(user.id, subscribeDto.planName);
  }
}

