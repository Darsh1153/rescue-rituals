import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RsvpService {
  constructor(private readonly prisma: PrismaService) {}

  async join(eventId: string, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the event row to serialize concurrent RSVPs under capacity pressure
        const rows = await tx.$queryRaw<
          Array<{ id: string; title: string; capacity: number }>
        >`
          SELECT id, title, capacity FROM "Event"
          WHERE id = ${eventId}
          FOR UPDATE
        `;

        if (!rows.length) {
          throw new NotFoundException('Event not found');
        }

        const event = rows[0];

        const existing = await tx.rsvp.findUnique({
          where: { userId_eventId: { userId, eventId } },
        });
        if (existing) {
          throw new ConflictException('You have already RSVPed to this event');
        }

        const attendeeCount = await tx.rsvp.count({ where: { eventId } });
        if (attendeeCount >= event.capacity) {
          throw new BadRequestException('Event is at full capacity');
        }

        const rsvp = await tx.rsvp.create({
          data: { eventId, userId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            event: { select: { id: true, title: true, capacity: true } },
          },
        });

        return {
          id: rsvp.id,
          eventId: rsvp.eventId,
          user: rsvp.user,
          event: rsvp.event,
          attendeeCount: attendeeCount + 1,
          spotsLeft: event.capacity - attendeeCount - 1,
          createdAt: rsvp.createdAt,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already RSVPed to this event');
      }
      throw error;
    }
  }

  async cancel(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const existing = await this.prisma.rsvp.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!existing) {
      throw new NotFoundException('RSVP not found');
    }

    await this.prisma.rsvp.delete({
      where: { userId_eventId: { userId, eventId } },
    });

    const attendeeCount = await this.prisma.rsvp.count({ where: { eventId } });
    return {
      message: 'RSVP cancelled',
      eventId,
      attendeeCount,
      spotsLeft: event.capacity - attendeeCount,
    };
  }

  async listAttendees(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const rsvps = await this.prisma.rsvp.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      eventId,
      capacity: event.capacity,
      attendeeCount: rsvps.length,
      spotsLeft: Math.max(event.capacity - rsvps.length, 0),
      attendees: rsvps.map((r) => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        rsvpedAt: r.createdAt,
      })),
    };
  }
}
