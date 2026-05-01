import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { NoteService } from './note.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { ConnectedUser } from 'src/auth/decorator/user.decorator';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('note')
@UseGuards(JwtAuthGuard)
export class NoteController {
  constructor(private readonly noteService: NoteService) {}
  @Post()
  getnoteId(@ConnectedUser() user : JwtPayload) {
    console.log(user);
    
    return this.noteService.getnoteId(user);
  }

//   @Post()
//   create(@Body() createNoteDto: CreateNoteDto) {
//     return this.noteService.create(createNoteDto);
//   }

//   @Get()
//   findAll() {
//     return this.noteService.findAll();
//   }

//   @Get(':id')
//   findOne(@Param('id') id: string) {
//     return this.noteService.findOne(+id);
//   }

//   // @Patch(':id')
//   // update(@Param('id') id: string, @Body() updateNoteDto: UpdateNoteDto) {
//   //   return this.noteService.update(+id, updateNoteDto);
//   // }

//   @Delete(':id')
//   remove(@Param('id') id: string) {
//     return this.noteService.remove(+id);
//   }
}
