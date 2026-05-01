    import { Target } from "src/enum/target.enum";

    export const Query = {
        hello: (_parent: any, _args: any, _context) => {
            return 'Hello World!';
        },
        users(_parent: any, _args: any, context) {
            return context.userService.getAllUsers();
        },
        operation(_parent: any, _args: any, context) {
            if (context.user.role !== 'manager') {
                throw new Error('Access denied: Only managers can view history');
            }
            console.log('Fetching history for company:', context.user);
            return context.historyService.getHistory(context.user.companyCode, _args.limit,_args.start);
        },

        async NoteLines(_parent: any, _args: {noteId: number, start:number, limit: number}, context) {
            console.log('Fetching note lines for note ID:', _args.noteId);
            const note = await context.noteService.getNoteById(_args.noteId);
            console.log('Note:', note);
            if (!note) {
                throw new Error(`Note with ID ${_args.noteId} not found`);
            }
            if (note.company.code !== context.user.companyCode) {
                throw new Error(`You do not have access to this note`);
            }
            const notelines = await context.noteLineService.getNoteLinesByNoteId(_args.noteId, _args.limit, _args.start);
            return notelines;
        },
        async operationBytargetType(_parent: any, _args: {targetType: string, start: number, limit: number}, context) {
            if (context.user.role !== 'manager') {
                throw new Error('Access denied: Only managers can view history');
            }
            console.log(_args.targetType)
            return context.historyService.getHistoryByTargetType(context.user.companyCode, _args.targetType, _args.start, _args.limit);
        },
        async operationByUser(_parent: any, _args: {username: String, start: number, limit: number}, context) {
            if (context.user.role !== 'manager') {
                throw new Error('Access denied: Only managers can view history');
            }
            console.log(_args)
            return context.historyService.getHistoryByUser(context.user.companyCode, _args.username, _args.start, _args.limit);
        },
        async OperationByTarget(_parent: any, _args: {targetType:Target, targetId: number}, context) {
            if (context.user.role !== 'manager') {
                throw new Error('Access denied: Only managers can view history');
            }
            return context.historyService.getHistoryById(context.user.companyCode, _args.targetType, _args.targetId);
        }
    }