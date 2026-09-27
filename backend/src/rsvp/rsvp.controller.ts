import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { RsvpService } from './rsvp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@ApiTags('rsvp')
@Controller('events')
export class RsvpController {
  constructor(private readonly rsvpService: RsvpService) {}

  @Post(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'RSVP / join an event (auth required)' })
  @ApiResponse({ status: 201, description: 'RSVP created' })
  @ApiResponse({ status: 400, description: 'Event at capacity' })
  @ApiResponse({ status: 409, description: 'Already RSVPed' })
  join(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rsvpService.join(id, user.userId);
  }

  @Delete(':id/rsvp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel your RSVP (auth required)' })
  @ApiResponse({ status: 404, description: 'RSVP or event not found' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rsvpService.cancel(id, user.userId);
  }

  @Get(':id/attendees')
  @ApiOperation({ summary: 'List attendees for an event (public)' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  listAttendees(@Param('id', ParseUUIDPipe) id: string) {
    return this.rsvpService.listAttendees(id);
  }
}
