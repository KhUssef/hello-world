import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { JwtExtractorService } from 'src/auth/Jwt.extractor.service';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { NoteService } from './note.service';
import { NoteLineService } from './noteLine.service';
import { UpdateNoteLineDto } from './dto/update-noteLine.dto';
import { ConnectedUser } from 'src/auth/decorator/user.decorator';



@WebSocketGateway({ cors: true, namespace: 'whiteboard' })
export class Notesocket implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private secret: string;

  // Map<noteId, Map<userId, lineNumber>>
  private noteLocks: Map<number, Map<string, number>> = new Map();
  private noteLineCounts: Map<number, number> = new Map();


  constructor(
    private readonly noteService: NoteService,
    private readonly noteLineService: NoteLineService,
    private readonly configService: ConfigService,
    private readonly extractor: JwtExtractorService,
  ) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not defined');
    this.secret = secret;
  }

  async handleConnection(client: Socket) {
    try {
      
      const token = client.handshake.query.Authorization as string;
      const decodedJwt = jwt.verify(token, this.secret) as any;
      const user = await this.extractor.validatePayload(decodedJwt);
      client.data.user = user;
      const noteIds = [...this.noteLocks.keys()];
      for (const noteId of noteIds) {
        const count = await this.noteService.lineCount(noteId);
        this.noteLineCounts.set(noteId, count);
      }

      client.join(user.companyCode);
      console.log(`Connected: ${user.username} [${user.sub}]`);
      console.log(this.noteLocks);
      // Send all current locks
      const allLocks: { noteId: number; username: string; lineNumber: number }[] = [];
      this.noteLocks.forEach((userMap, noteId) => {
        userMap.forEach((lineNumber, username) => {
          allLocks.push({ noteId, username, lineNumber });
        });
      });
      console.log('Sending current softlocks:', allLocks);

      setTimeout(() => {
  this.server.to(client.id).emit('currentSoftlocks', allLocks);
}, 100);
      console.log("lol")
    } catch (err) {
      console.error('Socket auth failed:', err.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user: JwtPayload = client.data.user;
    if (!user) return;

    let unlocked = false;

    for (const [noteId, userMap] of this.noteLocks) {
      if (userMap.has(user.username)) {
        const lineNumber = userMap.get(user.username);
        userMap.delete(user.username);
        if (userMap.size === 0) this.noteLocks.delete(noteId);

        this.server.to(user.companyCode).emit('softunlock', {
          userId: user.sub,
          noteId,
          lineNumber,
        });
        unlocked = true;
        break; // Only one lock per user globally
      }
    }

    if (unlocked) {
      console.log(`Disconnected: ${user.username} – lock removed`);
    }
  }
@SubscribeMessage('softlock')
async handleSoftLock(
  @MessageBody() data: { noteId: number; lineNumber: number },
  @ConnectedUser() user: JwtPayload,
) {
  if (!user) return;

  console.log(`Received softlock request from ${user.username} for note ${data.noteId} at line ${data.lineNumber}`);
let lineCount = this.noteLineCounts.get(data.noteId);
if (lineCount === undefined) {
  lineCount = await this.noteService.lineCount(data.noteId);
  this.noteLineCounts.set(data.noteId, lineCount);
}

if (data.lineNumber >= lineCount - 5) {
  const newLines = await this.noteLineService.createMultiple(5, data.noteId);
  this.noteLineCounts.set(data.noteId, lineCount + 5);
  console.log(`Created 5 new lines for note ${data.noteId}:`, newLines);

  // Notify all clients in the company about the new page
  this.server.to(user.companyCode).emit('newPageCreated', {
    noteId: data.noteId,
    newLines,
  });

  console.log(`Extended note ${data.noteId} with 5 new lines.`);
}

  // Check if the user already has a lock
  for (const [noteId, userMap] of this.noteLocks) {
    if (userMap.has(user.username)) {
      const oldLineNumber = userMap.get(user.username);

      // If it's the same noteId and lineNumber, skip
      if (noteId === data.noteId && oldLineNumber === data.lineNumber) {
        return;
      }

      // Remove old lock
      userMap.delete(user.username);
      if (userMap.size === 0) this.noteLocks.delete(noteId);

      this.server.to(user.companyCode).emit('softunlock', {
        userId: user.sub,
        noteId,
        lineNumber: oldLineNumber,
      });

      break; // Only one lock per user globally
    }
  }

  // Set new lock
  if (!this.noteLocks.has(data.noteId)) {
    this.noteLocks.set(data.noteId, new Map());
  }
  const userMap = this.noteLocks.get(data.noteId);
  if (userMap) {
    userMap.set(user.username, data.lineNumber);
  }

  this.server.to(user.companyCode).emit('softlock', {
    username: user.username,
    noteId: data.noteId,
    lineNumber: data.lineNumber,
  });
}


  @SubscribeMessage('softunlock')
  async handleSoftUnlock(
    @MessageBody() data: { noteId: number; lineNumber: number },
    @ConnectedUser() user: JwtPayload,
  ) {
    if (!user) return;
    console.log(`Received softunlock request from ${user.username} for note ${data.noteId} at line ${data.lineNumber}`);

    const userMap = this.noteLocks.get(data.noteId);
    if (userMap && userMap.get(user.username) === data.lineNumber) {
      userMap.delete(user.username);
      if (userMap.size === 0) this.noteLocks.delete(data.noteId);

      this.server.to(user.companyCode).emit('softunlock', {
        username: user.username,
        noteId: data.noteId,
        lineNumber: data.lineNumber,
      });
    }
  }
@SubscribeMessage('alterNote')
async handleNoteAltered(
  @MessageBody() note: UpdateNoteLineDto,
  @ConnectedUser() user: JwtPayload,
) {
  if (!user) return;
  console.log('Received note alteration request:', note);
  if (!note?.noteId) {
    throw new Error('Note ID is required for updating a note line');
    return;
  }

  // Check if the user has a soft lock on this noteId and lineNumber
  const userMap = this.noteLocks.get(note.noteId);
  const lockedLineNumber = userMap?.get(user.username);

  if (lockedLineNumber !== note.lineNumber) {
    // User does not hold lock on this line - reject the update
    console.warn(
      `User ${user.username} attempted to alter line ${note.lineNumber} of note ${note.noteId} without holding the soft lock.`
    );
    // Optionally emit an error to client:
    this.server.to(user.companyCode).emit('error', {
      message: 'You must hold the soft lock on this line to alter it.',
      noteId: note.noteId,
      lineNumber: note.lineNumber,
    });
    return;
  }

  try {
    // User holds the lock, allow partial update
    console.log('Updating note line:', note);
    const updatedNoteLine = await this.noteLineService.update(
      note.noteId,
      note,
      user.sub,
    );
    if (updatedNoteLine == null) {
      return;
    }
    this.server.to(user.companyCode).emit('noteUpdated', updatedNoteLine);
  } catch (error) {
    console.error('Error updating note line:', error);
    // Optionally emit an error event to the client here
  }
}



}
