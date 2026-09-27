import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateEventDto) {
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Invalid startsAt date');
    }

    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        startsAt,
        location: dto.location,
        capacity: dto.capacity,
        ownerId,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { rsvps: true } },
      },
    });

    return this.mapEvent(event);
  }

  async findAll(page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [total, events] = await Promise.all([
      this.prisma.event.count(),
      this.prisma.event.findMany({
        skip,
        take,
        orderBy: { startsAt: 'asc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { rsvps: true } },
        },
      }),
    ]);

    return {
      data: events.map((e) => this.mapEvent(e)),
      meta: { total, page: Math.max(page, 1), limit: take },
    };
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { rsvps: true } },
        rsvps: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return {
      ...this.mapEvent(event),
      attendees: event.rsvps.map((r) => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        rsvpedAt: r.createdAt,
      })),
    };
  }

  async update(id: string, userId: string, dto: UpdateEventDto) {
    const event = await this.getOwnedEvent(id, userId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.capacity !== undefined) {
      const currentCount = await this.prisma.rsvp.count({
        where: { eventId: id },
      });
      if (dto.capacity < currentCount) {
        throw new BadRequestException(
          `Capacity cannot be less than current attendees (${currentCount})`,
        );
      }
      data.capacity = dto.capacity;
    }
    if (dto.startsAt !== undefined) {
      const startsAt = new Date(dto.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException('Invalid startsAt date');
      }
      data.startsAt = startsAt;
    }

    const updated = await this.prisma.event.update({
      where: { id: event.id },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { rsvps: true } },
      },
    });

    return this.mapEvent(updated);
  }

  async remove(id: string, userId: string) {
    await this.getOwnedEvent(id, userId);
    await this.prisma.event.delete({ where: { id } });
    return { message: 'Event deleted' };
  }

  private async getOwnedEvent(id: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.ownerId !== userId) {
      throw new ForbiddenException('Only the event owner can modify this event');
    }
    return event;
  }

  private mapEvent(event: {
    id: string;
    title: string;
    description: string;
    startsAt: Date;
    location: string;
    capacity: number;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    owner: { id: string; name: string; email: string };
    _count: { rsvps: number };
  }) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      location: event.location,
      capacity: event.capacity,
      ownerId: event.ownerId,
      owner: event.owner,
      attendeeCount: event._count.rsvps,
      spotsLeft: Math.max(event.capacity - event._count.rsvps, 0),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
