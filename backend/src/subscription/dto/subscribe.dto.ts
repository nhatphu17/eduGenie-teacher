import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlanName } from '@prisma/client';

export class SubscribeDto {
  @ApiProperty({ enum: SubscriptionPlanName, example: SubscriptionPlanName.PRO })
  @IsEnum(SubscriptionPlanName)
  planName: SubscriptionPlanName;
}

