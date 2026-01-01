import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionPlan: {
          select: {
            id: true,
            name: true,
            dailyQuota: true,
            monthlyQuota: true,
            price: true,
          },
        },
        usageCountDaily: true,
        usageCountMonthly: true,
        createdAt: true,
      },
    });
  }

  async getUsageStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptionPlan: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      daily: {
        used: user.usageCountDaily,
        limit: user.subscriptionPlan.dailyQuota,
        remaining: Math.max(0, user.subscriptionPlan.dailyQuota - user.usageCountDaily),
      },
      monthly: {
        used: user.usageCountMonthly,
        limit: user.subscriptionPlan.monthlyQuota,
        remaining: Math.max(0, user.subscriptionPlan.monthlyQuota - user.usageCountMonthly),
      },
      plan: user.subscriptionPlan,
    };
  }
}

