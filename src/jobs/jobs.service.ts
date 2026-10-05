import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';

import { Prisma } from '../generated/prisma/client';

interface FindJobsOptions {
  hours?: number;

  source?: string;

  search?: string;

  page?: number;

  limit?: number;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: FindJobsOptions) {
    const page = Math.max(options.page ?? 1, 1);

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

    const hours = Math.min(Math.max(options.hours ?? 24, 1), 24 * 30);

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where: Prisma.JobWhereInput = {
      isActive: true,

      discoveredAt: {
        gte: since,
      },
    };

    if (options.source && options.source !== 'all') {
      where.source = options.source;
    }

    const search = options.search?.trim();

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          company: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          location: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          technologies: {
            has: search,
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,

        orderBy: {
          discoveredAt: 'desc',
        },

        skip: (page - 1) * limit,

        take: limit,
      }),

      this.prisma.job.count({
        where,
      }),
    ]);

    return {
      items,

      pagination: {
        page,
        limit,
        total,

        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: {
        id,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }
  async getSummary() {
    const now = new Date();

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const startToday = this.getBangkokStartOfDay(now);

    const [newToday, lastHour, active, sources] = await Promise.all([
      this.prisma.job.count({
        where: {
          discoveredAt: {
            gte: startToday,
          },
        },
      }),

      this.prisma.job.count({
        where: {
          discoveredAt: {
            gte: oneHourAgo,
          },
        },
      }),

      this.prisma.job.count({
        where: {
          isActive: true,
        },
      }),

      this.prisma.job.findMany({
        distinct: ['source'],

        select: {
          source: true,
        },
      }),
    ]);

    return {
      newToday,
      lastHour,
      active,
      sources: sources.length,
    };
  }
  private getBangkokStartOfDay(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',

      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);

    const year = Number(parts.find((part) => part.type === 'year')?.value);

    const month = Number(parts.find((part) => part.type === 'month')?.value);

    const day = Number(parts.find((part) => part.type === 'day')?.value);

    // Bangkok = UTC+7
    // 00:00 Bangkok = 17:00 UTC วันก่อน

    return new Date(Date.UTC(year, month - 1, day, -7, 0, 0));
  }
async getNewJobsByHour(hours = 24) {
  const safeHours = Math.min(
    Math.max(hours, 1),
    168,
  )

  const now = new Date()

  const currentHour = new Date(now)

  currentHour.setUTCMinutes(
    0,
    0,
    0,
  )

  const firstHour = new Date(
    currentHour.getTime() -
      (safeHours - 1) *
        60 *
        60 *
        1000,
  )

  const jobs =
    await this.prisma.job.findMany({
      where: {
        postedAt: {
          not: null,
          gte: firstHour,
        },
      },

      select: {
        postedAt: true,
      },
    })

  const buckets = new Map<
    number,
    number
  >()

  // สร้าง bucket ทุกชั่วโมง
  for (
    let index = 0;
    index < safeHours;
    index++
  ) {
    const bucket = new Date(
      firstHour.getTime() +
        index *
          60 *
          60 *
          1000,
    )

    buckets.set(
      bucket.getTime(),
      0,
    )
  }

  // นับตาม postedAt
  for (const job of jobs) {
    if (!job.postedAt) {
      continue
    }

    const postedHour =
      new Date(job.postedAt)

    postedHour.setUTCMinutes(
      0,
      0,
      0,
    )

    const key =
      postedHour.getTime()

    if (buckets.has(key)) {
      buckets.set(
        key,
        (buckets.get(key) ?? 0) + 1,
      )
    }
  }

  const formatter =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Asia/Bangkok',

        hour: '2-digit',
        minute: '2-digit',

        hour12: false,
      },
    )

  return Array.from(
    buckets.entries(),
  ).map(
    ([timestamp, count]) => ({
      hour:
        formatter.format(
          new Date(timestamp),
        ),

      count,
    }),
  )
}
async getSources() {
  const sources =
    await this.prisma.job.findMany({
      distinct: ['source'],

      select: {
        source: true,
      },

      orderBy: {
        source: 'asc',
      },
    })

  return sources.map(
    (item) => item.source,
  )
}
}
