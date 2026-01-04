import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlanName } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async getPlan(planName: SubscriptionPlanName) {
    return this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });
  }

  async subscribe(userId: string, planName: SubscriptionPlanName) {
    const plan = await this.getPlan(planName);
    if (!plan) {
      throw new BadRequestException('Subscription plan not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlanId: plan.id,
        usageCountDaily: 0,
        usageCountMonthly: 0,
        lastUsageReset: new Date(),
      },
      include: {
        subscriptionPlan: true,
      },
    });
  }

  async checkQuota(userId: string): Promise<{ canProceed: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptionPlan: true,
      },
    });

    if (!user) {
      return { canProceed: false, reason: 'User not found' };
    }

    // Reset daily quota if needed
    const now = new Date();
    const lastReset = user.lastUsageReset || user.createdAt;
    const daysSinceReset = Math.floor(
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceReset >= 1) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          usageCountDaily: 0,
          lastUsageReset: now,
        },
      });
      user.usageCountDaily = 0;
    }

    // Reset monthly quota if needed
    const monthsSinceReset = Math.floor(
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    if (monthsSinceReset >= 1) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          usageCountMonthly: 0,
          lastUsageReset: now,
        },
      });
      user.usageCountMonthly = 0;
    }

    // Check daily quota
    if (user.usageCountDaily >= user.subscriptionPlan.dailyQuota) {
      return {
        canProceed: false,
        reason: `Daily quota exceeded (${user.usageCountDaily}/${user.subscriptionPlan.dailyQuota}). Please upgrade or wait until tomorrow.`,
      };
    }

    // Check monthly quota
    if (user.usageCountMonthly >= user.subscriptionPlan.monthlyQuota) {
      return {
        canProceed: false,
        reason: `Monthly quota exceeded (${user.usageCountMonthly}/${user.subscriptionPlan.monthlyQuota}). Please upgrade your plan.`,
      };
    }

    return { canProceed: true };
  }

  async incrementUsage(userId: string, tokensUsed: number = 1) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        usageCountDaily: { increment: 1 },
        usageCountMonthly: { increment: 1 },
      },
    });
  }
}



